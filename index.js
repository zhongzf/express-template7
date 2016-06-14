"use strict";

var expressTemplate7 = require('./lib/express-template7');

// -----------------------------------------------------------------------------

function template7(config) {
    return create(config).engine;
}

function create(config) {
    return new expressTemplate7.ExpressTemplate7(config);
}

// -----------------------------------------------------------------------------

exports = module.exports  = template7;
exports.create            = create;
exports.ExpressTemplate7 = expressTemplate7.ExpressTemplate7;
