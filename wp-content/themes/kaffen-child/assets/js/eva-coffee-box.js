(function () {
  "use strict";

  var config = window.EvaCoffeeBoxConfig || {};

  function getMessage(key, fallback) {
    if (config.i18n && config.i18n[key]) {
      return config.i18n[key];
    }

    return fallback;
  }

  function normalizeValue(value) {
    return String(value || "").trim().toLowerCase();
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
        var candidate = normalizeValue(variation.attributes[key]);

        if (!selected || selected !== candidate) {
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

  function highlightTargetCard(targetCard, cards) {
    for (var i = 0; i < cards.length; i += 1) {
      cards[i].classList.remove("eva-card-targeted");
    }

    if (targetCard) {
      targetCard.classList.add("eva-card-targeted");
    }
  }

  function handleComparisonCtas(cards) {
    var compareCtas = document.querySelectorAll("[data-eva-compare-cta]");
    if (!compareCtas.length || !cards.length) {
      return;
    }

    function moveToCard(targetCardId, liveMessage) {
      if (!targetCardId) {
        return;
      }

      var targetCard = document.querySelector('.eva-card[data-card-id="' + targetCardId + '"]');
      if (!targetCard) {
        return;
      }

      highlightTargetCard(targetCard, cards);

      var reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      targetCard.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });

      focusCardTarget(targetCard);

      if (!liveMessage) {
        return;
      }

      var liveRegion = targetCard.querySelector(".eva-live");
      if (!liveRegion) {
        return;
      }

      liveRegion.classList.remove("is-error", "is-success");
      liveRegion.classList.add("is-info");
      liveRegion.textContent = liveMessage;
    }

    for (var i = 0; i < compareCtas.length; i += 1) {
      compareCtas[i].addEventListener("click", function (event) {
        event.preventDefault();

        var targetCardId = this.dataset.targetCard || "";
        var liveMessage = this.dataset.liveMessage || "";
        moveToCard(targetCardId, liveMessage);
      });
    }
  }

  function initCard(card) {
    var selectEls = card.querySelectorAll(".eva-select");
    var button = card.querySelector(".eva-cta");
    var liveRegion = card.querySelector(".eva-live");
    var productId = card.dataset.productId || "";
    var variations = [];
    var selectedVariation = null;
    var isCheckoutMode = false;
    var inFlight = false;
    var requestTimeout = Number(config.requestTimeout) || 12000;

    if (!button || !productId || !selectEls.length) {
      return;
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
      if (inFlight) {
        setButtonState(button, false);
        return;
      }

      if (isCheckoutMode) {
        setButtonState(button, true);
        return;
      }

      var attrs = collectSelectedAttributes();

      if (!allSelected(attrs)) {
        selectedVariation = null;
        setButtonState(button, false);
        updateAvailabilityMessage("");
        return;
      }

      selectedVariation = matchVariation(variations, attrs);
      setButtonState(button, Boolean(selectedVariation));

      if (!selectedVariation) {
        updateAvailabilityMessage(getMessage("selectPrompt", "Selezione non valida"), "error");
      } else {
        updateAvailabilityMessage("");
      }
    }

    function setLoadingState(active) {
      inFlight = active;

      if (active) {
        button.textContent = getMessage("adding", "Aggiunta in corso...");
        button.setAttribute("aria-busy", "true");
        setButtonState(button, false);
        return;
      }

      button.textContent = getMessage("addToCart", "Aggiungi al carrello");
      button.removeAttribute("aria-busy");
      syncButton();
    }

    function toCheckoutMode() {
      isCheckoutMode = true;
      button.classList.add("is-success");
      button.textContent = getMessage("goCheckout", "Vai al checkout");
      button.setAttribute("aria-label", button.textContent);
      button.removeAttribute("aria-busy");
      setButtonState(button, true);
    }

    function addToCart() {
      if (!selectedVariation || !config.ajaxUrl || inFlight) {
        return;
      }

      if (window.navigator && window.navigator.onLine === false) {
        updateAvailabilityMessage(getMessage("offline", "Sei offline. Controlla la connessione e riprova."), "error");
        return;
      }

      setLoadingState(true);

      var attrs = collectSelectedAttributes();
      var payload = new URLSearchParams();
      payload.set("product_id", productId);
      payload.set("quantity", "1");
      payload.set("variation_id", String(selectedVariation.variation_id));

      Object.keys(attrs).forEach(function (attributeKey) {
        payload.set("variation[" + attributeKey + "]", attrs[attributeKey]);
      });

      var controller = null;
      var timeoutId = null;
      var requestOptions = {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: payload.toString(),
      };

      if (typeof window.AbortController === "function") {
        controller = new window.AbortController();
        requestOptions.signal = controller.signal;
        timeoutId = window.setTimeout(function () {
          controller.abort();
        }, requestTimeout);
      }

      fetch(config.ajaxUrl, requestOptions)
        .then(function (response) {
          if (!response.ok) {
            throw { type: "http", status: response.status };
          }

          return response.text();
        })
        .then(function (rawData) {
          var data = parseJsonSafely(rawData);

          if (!data || typeof data !== "object") {
            throw { type: "invalid-response" };
          }

          if (data && data.error && data.product_url) {
            window.location.href = data.product_url;
            return;
          }

          updateAvailabilityMessage(getMessage("added", "Aggiunto ✓"), "success");
          toCheckoutMode();

          if (document.body) {
            document.body.dispatchEvent(new CustomEvent("wc_fragment_refresh"));
          }
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
        });
    }

    for (var i = 0; i < selectEls.length; i += 1) {
      selectEls[i].addEventListener("change", function () {
        syncButton();
      });
    }

    button.addEventListener("click", function () {
      if (isCheckoutMode) {
        var checkoutUrl = button.dataset.checkoutUrl || config.checkoutUrl || "";
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        }
        return;
      }

      addToCart();
    });

    syncButton();
  }

  function initLanding() {
    var cards = document.querySelectorAll(".eva-card[data-product-id]");
    handleAccordion();
    handleComparisonCtas(cards);

    if (!cards.length) {
      return;
    }

    for (var i = 0; i < cards.length; i += 1) {
      initCard(cards[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLanding);
  } else {
    initLanding();
  }
})();
