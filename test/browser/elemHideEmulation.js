/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

const {ElemHideEmulation} = require("../../lib/content/elemHideEmulation");

const REFRESH_INTERVAL = 200;

let testDocument = null;

exports.setUp = function(callback)
{
  let iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  testDocument = iframe.contentDocument;

  callback();
};

exports.tearDown = function(callback)
{
  let iframe = testDocument.defaultView.frameElement;
  iframe.parentNode.removeChild(iframe);
  testDocument = null;

  callback();
};

function timeout(delay)
{
  return new Promise((resolve, reject) =>
  {
    window.setTimeout(resolve, delay);
  });
}

function unexpectedError(error)
{
  console.error(error);
  this.ok(false, "Unexpected error: " + error);
}

function expectHidden(test, element)
{
  test.equal(window.getComputedStyle(element).display, "none",
             "The element's display property should be set to 'none'");
}

function expectVisible(test, element)
{
  test.notEqual(window.getComputedStyle(element).display, "none",
                "The element's display property should not be set to 'none'");
}

function findUniqueId()
{
  let id = "elemHideEmulationTest-" + Math.floor(Math.random() * 10000);
  if (!testDocument.getElementById(id))
    return id;
  return findUniqueId();
}

function insertStyleRule(rule)
{
  let styleElement;
  let styleElements = testDocument.head.getElementsByTagName("style");
  if (styleElements.length)
    styleElement = styleElements[0];
  else
  {
    styleElement = testDocument.createElement("style");
    testDocument.head.appendChild(styleElement);
  }
  styleElement.sheet.insertRule(rule, styleElement.sheet.cssRules.length);
}

// Insert a <div> with a unique id and a CSS rule
// for the the selector matching the id.
function createElementWithStyle(styleBlock, parent)
{
  let element = testDocument.createElement("div");
  element.id = findUniqueId();
  if (!parent)
    testDocument.body.appendChild(element);
  else
    parent.appendChild(element);
  insertStyleRule("#" + element.id + " " + styleBlock);
  return element;
}

// Create a new ElemHideEmulation instance with @selectors.
function applyElemHideEmulation(selectors)
{
  return Promise.resolve().then(() =>
  {
    let elemHideEmulation = new ElemHideEmulation(
      newSelectors =>
      {
        if (!newSelectors.length)
          return;
        let selector = newSelectors.join(", ");
        insertStyleRule(selector + "{display: none !important;}");
      },
      elems =>
      {
        for (let elem of elems)
          elem.style.display = "none";
      }
    );

    elemHideEmulation.document = testDocument;
    elemHideEmulation.MIN_INVOCATION_INTERVAL = REFRESH_INTERVAL / 2;
    elemHideEmulation.apply(selectors.map(selector => ({selector})));
    return elemHideEmulation;
  });
}

exports.testVerbatimPropertySelector = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithPrefix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithPrefixNoMatch = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #fff}", parent);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithSuffix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0)) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertyPseudoSelectorWithPrefixAndSuffix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let middle = createElementWithStyle("{background-color: #000}", parent);
  let toHide = createElementWithStyle("{background-color: #000}", middle);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0)) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithWildcard = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(*color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithRegularExpression = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/.*color: rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithEscapedBrace = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/background.\\7B 0,6\\7D : rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithImproperlyEscapedBrace = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/background.\\7B0,6\\7D: rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testDynamicallyChangedProperty = function(test)
{
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, toHide);
    insertStyleRule("#" + toHide.id + " {background-color: #000}");

    return timeout(0);
  }).then(() =>
  {
    // Re-evaluation will only happen after a delay
    expectVisible(test, toHide);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassWithPropBeforeSelector = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{background-color: #000}", parent);
  insertStyleRule(`#${child.id}::before {content: "publicite"}`);

  applyElemHideEmulation(
    ["div:-abp-properties(content: \"publicite\")"]
  ).then(() =>
  {
    expectHidden(test, child);
    expectVisible(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelector = function(test)
{
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    ["div:-abp-has(div)"]
  ).then(() =>
  {
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithPrefix = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  applyElemHideEmulation(
    ["div:-abp-has(div)"]
  ).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffix = function(test)
{
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let child = createElementWithStyle("{}", middle);
  applyElemHideEmulation(
    ["div:-abp-has(div) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, middle);
    expectHidden(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffixSibling = function(test)
{
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    ["div:-abp-has(div) + div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffixSiblingChild = function(test)
{
  //  <div>
  //    <div></div>
  //    <div>
  //      <div>to hide</div>
  //    </div>
  //  </div>
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let sibling = createElementWithStyle("{}");
  let toHide = createElementWithStyle("{}", sibling);
  applyElemHideEmulation(
    ["div:-abp-has(div) + div > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectVisible(test, sibling);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

function runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(test, selector, expectations)
{
  testDocument.body.innerHTML = `<div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling">
        <div id="tohide">to hide</div>
      </div>
      <div id="sibling2">
        <div id="sibling21"><div id="sibling211" class="inside"></div></div>
      </div>
    </div>`;
  let elems = {
    parent: testDocument.getElementById("parent"),
    middle: testDocument.getElementById("middle"),
    inside: testDocument.getElementById("inside"),
    sibling: testDocument.getElementById("sibling"),
    sibling2: testDocument.getElementById("sibling2"),
    toHide: testDocument.getElementById("tohide")
  };

  insertStyleRule(".inside {}");

  applyElemHideEmulation(
    [selector]
  ).then(() =>
  {
    for (let elem in expectations)
      if (elems[elem])
      {
        if (expectations[elem])
          expectVisible(test, elems[elem]);
        else
          expectHidden(test, elems[elem]);
      }
  }).catch(unexpectedError.bind(test)).then(() => test.done());
}

exports.testPseudoClassHasSelectorWithHasAndWithSuffixSibling = function(test)
{
  let expectations = {
    parent: true,
    middile: true,
    inside: true,
    sibling: true,
    sibling2: true,
    toHide: false
  };
  runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(
    test, "div:-abp-has(:-abp-has(div.inside)) + div > div", expectations);
};

exports.testPseudoClassHasSelectorWithHasAndWithSuffixSibling2 = function(test)
{
  let expectations = {
    parent: true,
    middile: true,
    inside: true,
    sibling: true,
    sibling2: true,
    toHide: false
  };
  runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(
    test, "div:-abp-has(:-abp-has(> div.inside)) + div > div", expectations);
};

exports.testPseudoClassHasSelectorWithSuffixSiblingNoop = function(test)
{
  let expectations = {
    parent: true,
    middile: true,
    inside: true,
    sibling: true,
    sibling2: true,
    toHide: true
  };
  runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(
    test, "div:-abp-has(> body div.inside) + div > div", expectations);
};

exports.testPseudoClassContains = function(test)
{
  testDocument.body.innerHTML = `<div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling">
        <div id="tohide">to hide</div>
      </div>
      <div id="sibling2">
        <div id="sibling21"><div id="sibling211" class="inside"></div></div>
      </div>
    </div>`;
  let parent = testDocument.getElementById("parent");
  let middle = testDocument.getElementById("middle");
  let inside = testDocument.getElementById("inside");
  let sibling = testDocument.getElementById("sibling");
  let sibling2 = testDocument.getElementById("sibling2");
  let toHide = testDocument.getElementById("tohide");

  applyElemHideEmulation(
    ["#parent div:-abp-contains(to hide)"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectVisible(test, inside);
    expectHidden(test, sibling);
    expectVisible(test, sibling2);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithPropSelector = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectVisible(test, child);
    expectHidden(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithPropSelector2 = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  insertStyleRule("body #" + parent.id + " > div { background-color: #000}");
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectVisible(test, child);
    expectHidden(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testDomUpdatesStyle = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectVisible(test, child);
    expectVisible(test, parent);

    insertStyleRule("body #" + parent.id + " > div { background-color: #000}");
    return timeout(0);
  }).then(() =>
  {
    expectVisible(test, child);
    expectVisible(test, parent);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectVisible(test, child);
    expectHidden(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testDomUpdatesContent = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  applyElemHideEmulation(
    ["div > div:-abp-contains(hide me)"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);

    child.textContent = "hide me";
    return timeout(0);
  }).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testDomUpdatesNewElement = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{ background-color: #000}", parent);
  let sibling;
  let child2;
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);

    sibling = createElementWithStyle("{}");
    return timeout(0);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
    expectVisible(test, sibling);

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
    expectVisible(test, sibling);

    child2 = createElementWithStyle("{ background-color: #000}",
                                    sibling);
    return timeout(0);
  }).then(() =>
  {
    expectVisible(test, child2);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
    expectHidden(test, sibling);
    expectVisible(test, child2);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
