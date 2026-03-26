(function () {
  "use strict";

  var config = window.EvaCoffeeBoxConfig || {};
  var storeApiSessionPromise = null;

  function getMessage(key, fallback) {
    if (config.i18n && config.i18n[key]) {
      return config.i18n[key];
    }

    return fallback;
  }

  function normalizeValue(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function compactValue(value) {
    return normalizeValue(value).replace(/-/g, "");
  }

  function toRequestAttributeValue(value) {
    return String(value || "").trim();
  }

  function normalizeAttributeKey(key) {
    return normalizeValue(String(key || "").replace(/^attribute_/i, "").replace(/^pa_/i, ""));
  }

  function getVariationAttributeValue(attributes, selectedKey) {
    if (!attributes || !selectedKey) {
      return "";
    }

    if (Object.prototype.hasOwnProperty.call(attributes, selectedKey)) {
      return attributes[selectedKey];
    }

    var normalizedSelectedKey = normalizeAttributeKey(selectedKey);
    var attributeKeys = Object.keys(attributes);

    for (var i = 0; i < attributeKeys.length; i += 1) {
      var candidateKey = attributeKeys[i];
      if (normalizeAttributeKey(candidateKey) === normalizedSelectedKey) {
        return attributes[candidateKey];
      }
    }

    return "";
  }

  function getCanonicalVariationAttributeKey(attributes, selectedKey) {
    if (!attributes || !selectedKey) {
      return selectedKey || "";
    }

    if (Object.prototype.hasOwnProperty.call(attributes, selectedKey)) {
      return selectedKey;
    }

    var normalizedSelectedKey = normalizeAttributeKey(selectedKey);
    var attributeKeys = Object.keys(attributes);

    for (var i = 0; i < attributeKeys.length; i += 1) {
      var candidateKey = attributeKeys[i];
      if (normalizeAttributeKey(candidateKey) === normalizedSelectedKey) {
        return candidateKey;
      }
    }

    return selectedKey;
  }

  function buildVariationRequest(selectedAttributes, variation) {
    var attrs = selectedAttributes || {};
    var variationAttributes = variation && variation.attributes ? variation.attributes : {};

    return Object.keys(attrs).map(function (selectedKey) {
      var canonicalKey = getCanonicalVariationAttributeKey(variationAttributes, selectedKey);
      var canonicalValue = getVariationAttributeValue(variationAttributes, canonicalKey);
      var value = canonicalValue === "" ? attrs[selectedKey] : canonicalValue;

      return {
        attribute: canonicalKey,
        value: toRequestAttributeValue(value),
      };
    });
  }

  function resolveStickyCtaState(input) {
    var context = input || {};
    var activeCard = context.activeCard || null;

    if (!context.activeCardId || !activeCard) {
      return {
        action: "choose",
        label: context.chooseLabel || "Scegli il box",
        disabled: false,
      };
    }

    if (activeCard.isCheckoutMode) {
      return {
        action: "checkout",
        label: context.checkoutLabel || "Vai al checkout",
        disabled: false,
      };
    }

    if (activeCard.isLoading) {
      return {
        action: "add",
        label: context.loadingLabel || "Aggiunta in corso...",
        disabled: true,
      };
    }

    if (activeCard.canAddToCart === false) {
      return {
        action: "add",
        label: context.addToCartLabel || "Aggiungi al carrello",
        disabled: true,
      };
    }

    return {
      action: "add",
      label: context.addToCartLabel || "Aggiungi al carrello",
      disabled: false,
    };
  }

  function resolvePrimaryButtonEnabled(input) {
    var state = input || {};

    if (state.isCheckoutMode) {
      return true;
    }

    if (state.inFlight) {
      return false;
    }

    return Boolean(state.hasValidVariation);
  }

  function resolvePostAddUiMode(action) {
    if (action === "checkout") {
      return {
        showConfiguration: false,
        showSuccess: true,
      };
    }

    return {
      showConfiguration: true,
      showSuccess: false,
    };
  }

  function getViewportBottomOffset(innerHeight, visualViewport, options) {
    var context = options || {};
    var scrollY = typeof context.scrollY === "number" ? context.scrollY : null;
    var safeAreaInsetBottom =
      typeof context.safeAreaInsetBottom === "number" && Number.isFinite(context.safeAreaInsetBottom)
        ? context.safeAreaInsetBottom
        : 0;

    if (scrollY !== null && scrollY <= 0) {
      return 0;
    }

    if (!visualViewport || typeof innerHeight !== "number" || !Number.isFinite(innerHeight)) {
      return 0;
    }

    var height = typeof visualViewport.height === "number" ? visualViewport.height : innerHeight;
    var offsetTop = typeof visualViewport.offsetTop === "number" ? visualViewport.offsetTop : 0;
    var delta = innerHeight - (height + offsetTop);

    if (!Number.isFinite(delta) || delta <= 0) {
      return 0;
    }

    return Math.max(0, Math.round(delta - safeAreaInsetBottom));
  }

  function readSafeAreaInsetBottom(element) {
    if (!element || !window || typeof window.getComputedStyle !== "function") {
      return 0;
    }

    var styles = window.getComputedStyle(element);
    var raw = styles.getPropertyValue("--eva-safe-area-bottom") || "0";
    var parsed = Number.parseFloat(raw);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  }

  function parseJsonSafely(raw) {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function debugLog() {
    if (!config.debug || !window.console || typeof window.console.log !== "function") {
      return;
    }

    window.console.log.apply(window.console, arguments);
  }

  function getHttpErrorMessage(status) {
    if (status === 401) {
      return getMessage("unauthorized", "Sessione scaduta. Aggiorna la pagina e riprova.");
    }

    if (status === 403) {
      return getMessage("forbidden", "Non hai i permessi per completare questa azione.");
    }

    if (status === 404) {
      return getMessage("notFound", "Prodotto non trovato. Aggiorna la pagina.");
    }

    if (status === 429) {
      return getMessage("rateLimited", "Hai fatto troppi tentativi. Attendi qualche secondo.");
    }

    if (status >= 500) {
      return getMessage("serverError", "Errore temporaneo del server. Riprova tra poco.");
    }

    return getMessage("error", "Qualcosa è andato storto. Riprova.");
  }

  function getStoreApiCartUrl() {
    if (config.storeApiCartUrl) {
      return config.storeApiCartUrl;
    }

    return window.location.origin + "/wp-json/wc/store/v1/cart";
  }

  function getStoreApiAddItemUrl() {
    if (config.storeApiAddItemUrl) {
      return config.storeApiAddItemUrl;
    }

    return getStoreApiCartUrl() + "/add-item";
  }

  function getHeaderValue(headers, name) {
    if (!headers || !name) {
      return "";
    }

    return headers.get(name) || headers.get(name.toLowerCase()) || "";
  }

  function fetchStoreApiSession() {
    if (storeApiSessionPromise) {
      return storeApiSessionPromise;
    }

    storeApiSessionPromise = fetch(getStoreApiCartUrl(), {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    })
      .then(function (response) {
        if (!response.ok) {
          throw { type: "http", status: response.status };
        }

        return response.text().then(function (rawData) {
          var data = parseJsonSafely(rawData);

          if (!data || typeof data !== "object") {
            throw { type: "invalid-response" };
          }

          return {
            nonce: getHeaderValue(response.headers, "Nonce"),
            cartToken: getHeaderValue(response.headers, "Cart-Token"),
          };
        });
      })
      .catch(function (error) {
        storeApiSessionPromise = null;
        throw error;
      });

    return storeApiSessionPromise;
  }

  function primeStoreApiSession() {
    fetchStoreApiSession().catch(function () {
      return null;
    });
  }

  function setStoreApiSession(session) {
    storeApiSessionPromise = Promise.resolve({
      nonce: session && session.nonce ? session.nonce : "",
      cartToken: session && session.cartToken ? session.cartToken : "",
    });
  }

  function refreshCartFragments() {
    if (document.body) {
      document.body.dispatchEvent(new CustomEvent("wc_fragment_refresh"));
    }

    if (window.jQuery && window.jQuery(document.body).trigger) {
      window.jQuery(document.body).trigger("wc_fragment_refresh");
      window.jQuery(document.body).trigger("added_to_cart");
    }
  }

  function matchVariation(variations, selectedAttributes) {
    for (var i = 0; i < variations.length; i += 1) {
      var variation = variations[i];

      if (!variation || !variation.attributes) {
        continue;
      }

      if (variation.is_in_stock === false || variation.is_purchasable === false) {
        continue;
      }

      var keys = Object.keys(selectedAttributes);
      var isMatch = true;

      for (var k = 0; k < keys.length; k += 1) {
        var key = keys[k];
        var selected = normalizeValue(selectedAttributes[key]);
        var candidateRaw = getVariationAttributeValue(variation.attributes, key);

        if (candidateRaw === "") {
          continue;
        }

        var candidate = normalizeValue(candidateRaw);

        if (!selected || (selected !== candidate && compactValue(selectedAttributes[key]) !== compactValue(candidateRaw))) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return variation;
      }
    }

    return null;
  }

  function setButtonState(button, enabled) {
    if (!button) {
      return;
    }

    button.disabled = !enabled;
  }

  function handleAccordion() {
    var accordionRoot = document.querySelector("[data-eva-accordion]");
    if (!accordionRoot) {
      return;
    }

    accordionRoot.addEventListener("click", function (event) {
      var trigger = event.target.closest(".eva-accordion-trigger");
      if (!trigger) {
        return;
      }

      var panelId = trigger.getAttribute("aria-controls");
      var panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) {
        return;
      }

      var expanded = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", expanded ? "false" : "true");
      panel.hidden = expanded;
    });
  }

  function focusCardTarget(card) {
    if (!card) {
      return;
    }

    var heading = card.querySelector(".eva-card-title");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      try {
        heading.focus({ preventScroll: true });
      } catch (error) {
        heading.focus();
      }
      return;
    }

    var firstSelect = card.querySelector(".eva-select");
    if (firstSelect) {
      firstSelect.focus();
    }
  }

  function handleComparisonCtas(onSelectProduct) {
    var compareCtas = document.querySelectorAll("[data-eva-compare-cta]");
    if (!compareCtas.length) {
      return;
    }

    for (var i = 0; i < compareCtas.length; i += 1) {
      compareCtas[i].addEventListener("click", function (event) {
        event.preventDefault();

        var targetCardId = this.dataset.targetCard || "";
        var liveMessage = this.dataset.liveMessage || "";

        if (typeof onSelectProduct === "function") {
          onSelectProduct(targetCardId, liveMessage);
        }
      });
    }
  }

  function initCard(card, onStateChange) {
    var form = card.querySelector(".eva-variation-form");
    var selectEls = card.querySelectorAll(".eva-select");
    var fieldEls = card.querySelectorAll(".eva-field");
    var button = card.querySelector(".eva-cta");
    var liveRegion = card.querySelector(".eva-live");
    var addSuccessPanel = card.querySelector("[data-eva-add-success]");
    var cardId = card.dataset.cardId || "";
    var productId = card.dataset.productId || "";
    var variations = [];
    var selectedVariation = null;
    var isCheckoutMode = false;
    var inFlight = false;
    var requestTimeout = Number(config.requestTimeout) || 12000;
    var addToCartLabel = getMessage("addToCart", "Aggiungi al carrello");
    var goCheckoutLabel = getMessage("goCheckout", "Vai al checkout");
    var feedbackTone = "";

    if (!button || !productId || !selectEls.length) {
      return null;
    }

    try {
      variations = JSON.parse(card.dataset.variations || "[]");
    } catch (error) {
      variations = [];
    }

    function updateAvailabilityMessage(message, tone) {
      if (!liveRegion) {
        return;
      }

      liveRegion.classList.remove("is-success", "is-error", "is-info");

      if (tone) {
        liveRegion.classList.add("is-" + tone);
      }

      liveRegion.textContent = message || "";
      feedbackTone = tone || "";
    }

    function notifyStateChange() {
      if (typeof onStateChange === "function") {
        onStateChange(cardId);
      }
    }

    function syncPostAddUi() {
      var mode = resolvePostAddUiMode(isCheckoutMode ? "checkout" : "add");

      if (fieldEls && fieldEls.length) {
        for (var i = 0; i < fieldEls.length; i += 1) {
          fieldEls[i].hidden = !mode.showConfiguration;
        }
      }

      if (addSuccessPanel) {
        addSuccessPanel.hidden = !mode.showSuccess;
      }

      if (liveRegion) {
        liveRegion.hidden = mode.showSuccess;
      }

      if (form) {
        form.classList.toggle("is-post-add-success", mode.showSuccess);
      }
    }

    function collectSelectedAttributes() {
      var attrs = {};

      for (var i = 0; i < selectEls.length; i += 1) {
        var el = selectEls[i];
        var key = el.dataset.attributeKey;
        if (!key) {
          continue;
        }
        attrs[key] = el.value;
      }

      return attrs;
    }

    function getFieldDefinitions() {
      var fields = [];

      for (var i = 0; i < selectEls.length; i += 1) {
        var el = selectEls[i];
        var attributeKey = el.dataset.attributeKey || "";
        if (!attributeKey) {
          continue;
        }

        var describedById = el.getAttribute("aria-describedby") || "";
        var noteEl = describedById ? document.getElementById(describedById) : null;
        var labelText = el.dataset.attributeLabel || "";
        var options = [];

        for (var optionIndex = 0; optionIndex < el.options.length; optionIndex += 1) {
          options.push({
            value: el.options[optionIndex].value,
            label: el.options[optionIndex].text,
          });
        }

        fields.push({
          key: attributeKey,
          label: labelText,
          note: noteEl ? noteEl.textContent : "",
          options: options,
        });
      }

      return fields;
    }

    function allSelected(attrs) {
      var keys = Object.keys(attrs);
      for (var i = 0; i < keys.length; i += 1) {
        if (!attrs[keys[i]]) {
          return false;
        }
      }
      return keys.length > 0;
    }

    function syncButton() {
      if (isCheckoutMode) {
        setButtonState(
          button,
          resolvePrimaryButtonEnabled({
            isCheckoutMode: true,
            inFlight: inFlight,
            hasValidVariation: true,
          })
        );
        return;
      }

      var attrs = collectSelectedAttributes();

      if (!allSelected(attrs)) {
        selectedVariation = null;
        setButtonState(
          button,
          resolvePrimaryButtonEnabled({
            isCheckoutMode: isCheckoutMode,
            inFlight: inFlight,
            hasValidVariation: false,
          })
        );
        updateAvailabilityMessage("");
        return;
      }

      selectedVariation = matchVariation(variations, attrs);
      setButtonState(
        button,
        resolvePrimaryButtonEnabled({
          isCheckoutMode: isCheckoutMode,
          inFlight: inFlight,
          hasValidVariation: Boolean(selectedVariation),
        })
      );

      if (!selectedVariation) {
        updateAvailabilityMessage(getMessage("selectPrompt", "Selezione non valida"), "error");
      } else {
        updateAvailabilityMessage("");
      }

      notifyStateChange();
    }

    function setLoadingState(active) {
      inFlight = active;

      if (active) {
        button.textContent = getMessage("adding", "Aggiunta in corso...");
        button.setAttribute("aria-busy", "true");
        setButtonState(button, false);
        notifyStateChange();
        return;
      }

      button.textContent = addToCartLabel;
      button.removeAttribute("aria-busy");
      syncButton();
      notifyStateChange();
    }

    function toCheckoutMode() {
      isCheckoutMode = true;
      button.classList.add("is-success");
      button.textContent = goCheckoutLabel;
      button.setAttribute("aria-label", button.textContent);
      button.removeAttribute("aria-busy");
      setButtonState(button, true);
      syncPostAddUi();
      notifyStateChange();
    }

    function resetState() {
      if (inFlight) {
        return;
      }

      isCheckoutMode = false;
      selectedVariation = null;

      for (var i = 0; i < selectEls.length; i += 1) {
        selectEls[i].value = "";
      }

      button.classList.remove("is-success");
      button.textContent = addToCartLabel;
      button.setAttribute("aria-label", addToCartLabel);
      button.removeAttribute("aria-busy");
      updateAvailabilityMessage("");
      syncPostAddUi();
      syncButton();
      notifyStateChange();
    }

    function setVisible(isVisible) {
      card.hidden = !isVisible;
      card.setAttribute("aria-hidden", isVisible ? "false" : "true");
      card.classList.toggle("eva-card-targeted", isVisible);
      notifyStateChange();
    }

    function setInfoMessage(message) {
      if (!message) {
        return;
      }

      updateAvailabilityMessage(message, "info");
      notifyStateChange();
    }

    function setSelectedAttributes(attributes) {
      var nextAttrs = attributes || {};

      for (var i = 0; i < selectEls.length; i += 1) {
        var el = selectEls[i];
        var key = el.dataset.attributeKey || "";

        if (!key) {
          continue;
        }

        el.value = Object.prototype.hasOwnProperty.call(nextAttrs, key) ? String(nextAttrs[key]) : "";
      }

      updateAvailabilityMessage("");
      syncButton();
      notifyStateChange();
    }

    function addToCart() {
      if (!selectedVariation || inFlight) {
        return;
      }

      if (window.navigator && window.navigator.onLine === false) {
        updateAvailabilityMessage(getMessage("offline", "Sei offline. Controlla la connessione e riprova."), "error");
        return;
      }

      setLoadingState(true);

      var attrs = collectSelectedAttributes();
      var controller = null;
      var timeoutId = null;

      if (typeof window.AbortController === "function") {
        controller = new window.AbortController();
        timeoutId = window.setTimeout(function () {
          controller.abort();
        }, requestTimeout);
      }

      fetchStoreApiSession()
        .then(function (session) {
          var variation = buildVariationRequest(attrs, selectedVariation);

          var headers = {
            Accept: "application/json",
            "Content-Type": "application/json",
          };

          if (session.nonce) {
            headers.Nonce = session.nonce;
          }

          if (session.cartToken) {
            headers["Cart-Token"] = session.cartToken;
          }

          var requestOptions = {
            method: "POST",
            credentials: "same-origin",
            headers: headers,
            body: JSON.stringify({
              id: Number(productId),
              quantity: 1,
              variation: variation,
            }),
          };

          if (controller) {
            requestOptions.signal = controller.signal;
          }

          debugLog("[EvaCoffeeBox] add-item payload", {
            id: Number(productId),
            quantity: 1,
            variation: variation,
            selectedVariation: selectedVariation,
          });

          return fetch(getStoreApiAddItemUrl(), requestOptions);
        })
        .then(function (response) {
          return response.text().then(function (rawData) {
            var data = parseJsonSafely(rawData);
            var nextSession = {
              nonce: getHeaderValue(response.headers, "Nonce"),
              cartToken: getHeaderValue(response.headers, "Cart-Token"),
            };

            if (!response.ok) {
              debugLog("[EvaCoffeeBox] add-item error", {
                status: response.status,
                data: data,
              });

              if (data && data.message) {
                throw { type: "store-api", message: data.message, status: response.status };
              }

              throw { type: "http", status: response.status };
            }

            if (!data || typeof data !== "object") {
              throw { type: "invalid-response" };
            }

            if (data.errors && data.errors.length) {
              throw { type: "store-api", message: data.errors[0].message || "", status: response.status };
            }

            setStoreApiSession(nextSession);

            updateAvailabilityMessage(getMessage("added", "Aggiunto ✓"), "success");
            toCheckoutMode();
            refreshCartFragments();
          });
        })
        .catch(function (error) {
          if (error && error.name === "AbortError") {
            updateAvailabilityMessage(getMessage("timeout", "La richiesta sta impiegando troppo tempo. Riprova."), "error");
            return;
          }

          if (error && error.type === "http") {
            updateAvailabilityMessage(getHttpErrorMessage(error.status), "error");
            return;
          }

          if (error && error.type === "invalid-response") {
            updateAvailabilityMessage(getMessage("invalidResponse", "Risposta non valida dal server. Riprova."), "error");
            return;
          }

          if (error && error.type === "store-api") {
            updateAvailabilityMessage(error.message || getMessage("error", "Qualcosa è andato storto. Riprova."), "error");
            return;
          }

          updateAvailabilityMessage(getMessage("error", "Errore, riprova"), "error");
        })
        .finally(function () {
          if (timeoutId) {
            window.clearTimeout(timeoutId);
          }

          if (!isCheckoutMode) {
            setLoadingState(false);
          }

          syncButton();
          notifyStateChange();
        });
    }

    function goToCheckout() {
      var checkoutUrl = button.dataset.checkoutUrl || config.checkoutUrl || "";
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    }

    function triggerPrimaryAction() {
      if (isCheckoutMode) {
        goToCheckout();
        return;
      }

      addToCart();
    }

    for (var i = 0; i < selectEls.length; i += 1) {
      selectEls[i].addEventListener("change", function () {
        updateAvailabilityMessage("");
        syncButton();
      });
    }

    button.addEventListener("click", function () {
      triggerPrimaryAction();
    });

    syncButton();
    syncPostAddUi();
    notifyStateChange();

    return {
      cardId: cardId,
      element: card,
      resetState: resetState,
      setVisible: setVisible,
      setInfoMessage: setInfoMessage,
      setSelectedAttributes: setSelectedAttributes,
      getSelectedAttributes: collectSelectedAttributes,
      getFieldDefinitions: getFieldDefinitions,
      getProductName: function () {
        var title = card.querySelector(".eva-card-title");
        return title ? title.textContent : "";
      },
      getFeedbackState: function () {
        return {
          message: liveRegion ? liveRegion.textContent || "" : "",
          tone: feedbackTone,
        };
      },
      triggerPrimaryAction: triggerPrimaryAction,
      getStickyState: function () {
        return {
          isCheckoutMode: isCheckoutMode,
          isLoading: inFlight,
          canAddToCart: !button.disabled,
        };
      },
      focus: function () {
        focusCardTarget(card);
      },
    };
  }

  function initLanding() {
    var cards = document.querySelectorAll(".eva-card[data-product-id]");
    var landingRoot = document.querySelector(".eva-coffee-box");
    var cardsWrap = document.querySelector(".eva-cards");
    var configurePlaceholder = document.querySelector("[data-eva-config-placeholder]");
    var changeBoxButton = document.querySelector("[data-eva-change-box]");
    var miniToggle = document.querySelector("[data-eva-mini-toggle]");
    var miniPanel = document.querySelector("[data-eva-mini-panel]");
    var chooseTitle = document.getElementById("eva-choose-title");
    var stickyCtaWrap = document.querySelector("[data-eva-sticky-cta-wrap]");
    var stickyStep2 = document.querySelector("[data-eva-sticky-step2]");
    var stickyProduct = document.querySelector("[data-eva-sticky-product]");
    var stickyFields = document.querySelector("[data-eva-sticky-fields]");
    var stickySuccess = document.querySelector("[data-eva-sticky-success]");
    var stickyPrimaryButton = document.querySelector("[data-eva-sticky-primary]");
    var stickyChangeButton = document.querySelector("[data-eva-sticky-change]");
    var stickyLive = document.querySelector("[data-eva-sticky-live]");
    var controllers = [];
    var controllersById = {};
    var activeCardId = "";
    var stickyRenderedCardId = "";
    var mobileQuery = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 699px)") : null;
    var stickyHideTimeoutId = 0;

    handleAccordion();

    if (!cards.length) {
      return;
    }

    function isMobileViewport() {
      return !!(mobileQuery && mobileQuery.matches);
    }

    function readStickyFormValues() {
      var attrs = {};
      if (!stickyFields) {
        return attrs;
      }

      var stickySelects = stickyFields.querySelectorAll(".eva-sticky-step2__select[data-attribute-key]");
      for (var i = 0; i < stickySelects.length; i += 1) {
        var key = stickySelects[i].dataset.attributeKey || "";
        if (!key) {
          continue;
        }

        attrs[key] = stickySelects[i].value;
      }

      return attrs;
    }

    function renderStickyFields(controller) {
      if (!stickyFields || !controller) {
        return;
      }

      var fields = controller.getFieldDefinitions();
      var selectedAttrs = controller.getSelectedAttributes();

      stickyFields.innerHTML = "";

      for (var i = 0; i < fields.length; i += 1) {
        var field = fields[i];
        var fieldWrap = document.createElement("div");
        fieldWrap.className = "eva-sticky-step2__field";

        var label = document.createElement("label");
        label.className = "eva-sticky-step2__label";
        label.textContent = field.label;

        var select = document.createElement("select");
        select.className = "eva-sticky-step2__select";
        select.dataset.attributeKey = field.key;

        for (var optionIndex = 0; optionIndex < field.options.length; optionIndex += 1) {
          var optionData = field.options[optionIndex];
          var option = document.createElement("option");
          option.value = optionData.value;
          option.textContent = optionData.label;
          select.appendChild(option);
        }

        select.value = Object.prototype.hasOwnProperty.call(selectedAttrs, field.key) ? selectedAttrs[field.key] : "";

        select.addEventListener("change", function () {
          var activeController = activeCardId ? controllersById[activeCardId] : null;
          if (!activeController) {
            return;
          }

          activeController.setSelectedAttributes(readStickyFormValues());
          updateStickyCta();
        });

        fieldWrap.appendChild(label);

        if (field.note) {
          var note = document.createElement("p");
          note.className = "eva-sticky-step2__note";
          note.textContent = field.note;
          fieldWrap.appendChild(note);
        }

        fieldWrap.appendChild(select);
        stickyFields.appendChild(fieldWrap);
      }
    }

    function setMobileStep2Mode(active) {
      if (!landingRoot || !cardsWrap) {
        return;
      }

      var enabled = Boolean(active && isMobileViewport());
      landingRoot.classList.toggle("eva-mobile-step2-active", enabled);
      cardsWrap.setAttribute("aria-hidden", enabled ? "true" : "false");
    }

    function showStickyStep2() {
      if (!stickyCtaWrap) {
        return;
      }

      updateStickyViewportOffset();

      if (stickyHideTimeoutId) {
        window.clearTimeout(stickyHideTimeoutId);
        stickyHideTimeoutId = 0;
      }

      if (stickyCtaWrap.hidden) {
        stickyCtaWrap.hidden = false;
      }

      if (stickyCtaWrap.classList.contains("is-visible")) {
        return;
      }

      window.requestAnimationFrame(function () {
        stickyCtaWrap.classList.add("is-visible");
      });
    }

    function hideStickyStep2() {
      if (!stickyCtaWrap) {
        return;
      }

      stickyCtaWrap.classList.remove("is-visible");

      if (stickyHideTimeoutId) {
        window.clearTimeout(stickyHideTimeoutId);
      }

      stickyHideTimeoutId = window.setTimeout(function () {
        if (!stickyCtaWrap.classList.contains("is-visible")) {
          stickyCtaWrap.hidden = true;
        }
      }, 280);
    }

    function updateStickyViewportOffset() {
      if (!stickyCtaWrap) {
        return;
      }

      var offset = getViewportBottomOffset(window.innerHeight, window.visualViewport || null, {
        scrollY: window.scrollY,
        safeAreaInsetBottom: readSafeAreaInsetBottom(stickyCtaWrap),
      });
      stickyCtaWrap.style.setProperty("--eva-ios-bottom-offset", offset + "px");
    }

    function updateStickyCta() {
      if (!stickyCtaWrap || !stickyStep2 || !stickyPrimaryButton || !stickyChangeButton) {
        return;
      }

      var activeController = activeCardId && controllersById[activeCardId] ? controllersById[activeCardId] : null;
      var activeCard = activeController ? activeController.getStickyState() : null;
      var stickyState = resolveStickyCtaState({
        activeCardId: activeCardId,
        activeCard: activeCard,
        chooseLabel: getMessage("chooseBox", "Scegli il box"),
        addToCartLabel: getMessage("addToCart", "Aggiungi al carrello"),
        checkoutLabel: getMessage("goCheckout", "Vai al checkout"),
        loadingLabel: getMessage("adding", "Aggiunta in corso..."),
      });
      var stickyMode = resolvePostAddUiMode(stickyState.action);

      stickyCtaWrap.dataset.stickyAction = stickyState.action;

      if (stickyState.action === "choose") {
        hideStickyStep2();
        stickyStep2.hidden = true;
        stickyRenderedCardId = "";
        setMobileStep2Mode(false);
        return;
      }

      showStickyStep2();
      stickyStep2.hidden = false;
      setMobileStep2Mode(true);

      if (stickyProduct) {
        stickyProduct.hidden = !stickyMode.showConfiguration;
      }

      if (stickyFields) {
        stickyFields.hidden = !stickyMode.showConfiguration;
      }

      if (stickyChangeButton) {
        stickyChangeButton.hidden = !stickyMode.showConfiguration;
      }

      if (stickyLive) {
        stickyLive.hidden = stickyMode.showSuccess;
      }

      if (stickySuccess) {
        stickySuccess.hidden = !stickyMode.showSuccess;
      }

      if (activeController && stickyProduct) {
        stickyProduct.textContent = activeController.getProductName();
      }

      if (stickyMode.showConfiguration && activeController && stickyRenderedCardId !== activeCardId) {
        renderStickyFields(activeController);
        stickyRenderedCardId = activeCardId;
      }

      stickyPrimaryButton.textContent = stickyState.label;
      stickyPrimaryButton.disabled = Boolean(stickyState.disabled);
      stickyPrimaryButton.setAttribute("aria-label", stickyState.label);

      if (stickyMode.showConfiguration && stickyFields && activeCard) {
        var selects = stickyFields.querySelectorAll(".eva-sticky-step2__select");
        for (var s = 0; s < selects.length; s += 1) {
          selects[s].disabled = Boolean(activeCard.isCheckoutMode || activeCard.isLoading);
        }
      }

      if (stickyLive && activeController) {
        var feedback = activeController.getFeedbackState();
        stickyLive.className = "eva-sticky-step2__live";
        if (feedback.tone) {
          stickyLive.classList.add("is-" + feedback.tone);
        }
        stickyLive.textContent = feedback.message || "";
      }
    }

    for (var i = 0; i < cards.length; i += 1) {
      var controller = initCard(cards[i], updateStickyCta);
      if (!controller || !controller.cardId) {
        continue;
      }

      controllers.push(controller);
      controllersById[controller.cardId] = controller;
    }

    function setIdleState() {
      activeCardId = "";

      for (var i = 0; i < controllers.length; i += 1) {
        controllers[i].resetState();
        controllers[i].setVisible(false);
      }

      if (configurePlaceholder) {
        configurePlaceholder.hidden = false;
      }

      if (changeBoxButton) {
        changeBoxButton.hidden = true;
      }

      stickyRenderedCardId = "";

      updateStickyCta();
    }

    function activateCard(targetCardId, liveMessage) {
      var controller = controllersById[targetCardId];
      if (!controller) {
        return;
      }

      primeStoreApiSession();

      activeCardId = targetCardId;

      for (var i = 0; i < controllers.length; i += 1) {
        var candidate = controllers[i];
        var isTarget = candidate.cardId === targetCardId;

        candidate.resetState();
        candidate.setVisible(isTarget);
      }

      if (configurePlaceholder) {
        configurePlaceholder.hidden = true;
      }

      if (changeBoxButton) {
        changeBoxButton.hidden = false;
      }

      var reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      controller.element.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });

      controller.focus();
      controller.setInfoMessage(liveMessage);

      if (miniPanel && !miniPanel.hidden) {
        miniPanel.hidden = true;
      }

      if (miniToggle) {
        miniToggle.setAttribute("aria-expanded", "false");
      }

      updateStickyCta();
    }

    handleComparisonCtas(function (targetCardId, liveMessage) {
      activateCard(targetCardId, liveMessage);
    });

    if (miniToggle && miniPanel) {
      miniToggle.addEventListener("click", function () {
        var expanded = miniToggle.getAttribute("aria-expanded") === "true";
        miniToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
        miniPanel.hidden = expanded;
      });
    }

    if (changeBoxButton) {
      changeBoxButton.addEventListener("click", function () {
        if (!activeCardId) {
          return;
        }

        setIdleState();

        var reduceMotion =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (chooseTitle) {
          chooseTitle.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "start",
          });

          chooseTitle.setAttribute("tabindex", "-1");
          try {
            chooseTitle.focus({ preventScroll: true });
          } catch (error) {
            chooseTitle.focus();
          }
        }

        updateStickyCta();
      });
    }

    if (stickyChangeButton) {
      stickyChangeButton.addEventListener("click", function () {
        if (!activeCardId) {
          return;
        }

        setIdleState();

        var reduceMotion =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (chooseTitle) {
          chooseTitle.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "start",
          });

          chooseTitle.setAttribute("tabindex", "-1");
          try {
            chooseTitle.focus({ preventScroll: true });
          } catch (error) {
            chooseTitle.focus();
          }
        }
      });
    }

    if (stickyPrimaryButton) {
      stickyPrimaryButton.addEventListener("click", function () {
        var activeController = activeCardId ? controllersById[activeCardId] : null;

        if (activeController) {
          activeController.triggerPrimaryAction();
          updateStickyCta();
        }
      });
    }

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", function () {
        updateStickyCta();
        updateStickyViewportOffset();
      });
    }

    if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
      window.visualViewport.addEventListener("resize", updateStickyViewportOffset);
      window.visualViewport.addEventListener("scroll", updateStickyViewportOffset);
    }

    if (typeof window.addEventListener === "function") {
      window.addEventListener("resize", updateStickyViewportOffset);
      window.addEventListener("orientationchange", updateStickyViewportOffset);
      window.addEventListener("scroll", updateStickyViewportOffset, { passive: true });
    }

    updateStickyViewportOffset();
    setIdleState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLanding);
  } else {
    initLanding();
  }

  if (window) {
    window.EvaCoffeeBoxTestUtils = window.EvaCoffeeBoxTestUtils || {};
    window.EvaCoffeeBoxTestUtils.buildVariationRequest = buildVariationRequest;
    window.EvaCoffeeBoxTestUtils.resolveStickyCtaState = resolveStickyCtaState;
    window.EvaCoffeeBoxTestUtils.resolvePrimaryButtonEnabled = resolvePrimaryButtonEnabled;
    window.EvaCoffeeBoxTestUtils.resolvePostAddUiMode = resolvePostAddUiMode;
    window.EvaCoffeeBoxTestUtils.getViewportBottomOffset = getViewportBottomOffset;
  }
})();
