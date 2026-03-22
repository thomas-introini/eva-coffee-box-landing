const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadCoffeeBoxScript() {
  const scriptPath = path.join(
    __dirname,
    "..",
    "wp-content",
    "themes",
    "kaffen-child",
    "assets",
    "js",
    "eva-coffee-box.js"
  );

  const source = fs.readFileSync(scriptPath, "utf8");
  const sandbox = {
    window: {
      location: { origin: "https://example.com" },
      matchMedia: () => ({ matches: false }),
    },
    document: {
      readyState: "loading",
      addEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      body: null,
    },
    CustomEvent: function CustomEvent() {},
    console,
    setTimeout,
    clearTimeout,
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  return sandbox.window.EvaCoffeeBoxTestUtils;
}

test("buildVariationRequest uses canonical variation keys and keeps selected value for wildcard attributes", () => {
  const utils = loadCoffeeBoxScript();

  assert.equal(typeof utils, "object");
  assert.equal(typeof utils.buildVariationRequest, "function");

  const request = utils.buildVariationRequest(
    {
      attribute_pa_macinatura_caffe_moka_espresso: "Chicchi",
      "attribute_macinatura-caffe-filtro": "Carta",
    },
    {
      attributes: {
        "attribute_macinatura-caffe-moka-espresso": "",
        "attribute_pa_macinatura-caffe-filtro": "Filtro",
      },
    }
  );

  assert.deepEqual(JSON.parse(JSON.stringify(request)), [
    {
      attribute: "attribute_macinatura-caffe-moka-espresso",
      value: "Chicchi",
    },
    {
      attribute: "attribute_pa_macinatura-caffe-filtro",
      value: "Filtro",
    },
  ]);
});

test("resolveStickyCtaState returns expected labels and actions by journey stage", () => {
  const utils = loadCoffeeBoxScript();

  assert.equal(typeof utils.resolveStickyCtaState, "function");

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        utils.resolveStickyCtaState({
          activeCardId: "",
          activeCard: null,
          addToCartLabel: "Aggiungi al carrello",
          checkoutLabel: "Vai al checkout",
          chooseLabel: "Scegli il box",
          loadingLabel: "Aggiunta in corso...",
        })
      )
    ),
    {
      action: "choose",
      label: "Scegli il box",
      disabled: false,
    }
  );

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        utils.resolveStickyCtaState({
          activeCardId: "full",
          activeCard: {
            isCheckoutMode: false,
            isLoading: false,
          },
          addToCartLabel: "Aggiungi al carrello",
          checkoutLabel: "Vai al checkout",
          chooseLabel: "Scegli il box",
          loadingLabel: "Aggiunta in corso...",
        })
      )
    ),
    {
      action: "add",
      label: "Aggiungi al carrello",
      disabled: false,
    }
  );

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        utils.resolveStickyCtaState({
          activeCardId: "full",
          activeCard: {
            isCheckoutMode: false,
            isLoading: true,
          },
          addToCartLabel: "Aggiungi al carrello",
          checkoutLabel: "Vai al checkout",
          chooseLabel: "Scegli il box",
          loadingLabel: "Aggiunta in corso...",
        })
      )
    ),
    {
      action: "add",
      label: "Aggiunta in corso...",
      disabled: true,
    }
  );

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        utils.resolveStickyCtaState({
          activeCardId: "full",
          activeCard: {
            isCheckoutMode: true,
            isLoading: false,
          },
          addToCartLabel: "Aggiungi al carrello",
          checkoutLabel: "Vai al checkout",
          chooseLabel: "Scegli il box",
          loadingLabel: "Aggiunta in corso...",
        })
      )
    ),
    {
      action: "checkout",
      label: "Vai al checkout",
      disabled: false,
    }
  );
});
