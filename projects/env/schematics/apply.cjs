"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = apply;
const reviewed_apply_js_1 = require("./reviewed-apply.cjs");
function apply(options) {
    return (tree, context) => (0, reviewed_apply_js_1.applyReviewedPlan)(tree, context, options);
}
