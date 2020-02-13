/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// Define color methods for standardization.
let clc = require('cli-color');
let header = clc.yellowBright; //clc.xterm(186); // Light yellow
let varFmt = clc.cyan;
let highlight = clc.magenta;
let cmdFmt = clc.cyanBright;
let questionPrefix = '[ ' + clc.yellow('?') + ' ]';

let success = function(text) {
    return '[ ' + clc.green('>') + ' ] ' + text;
};

let warn = function(text) {
    return '[ ' + clc.yellow('!') + ' ] ' + text;
};

let failure = function(text) {
    return '[ ' + clc.red('X') + ' ] ' + text;
};

module.exports = {
    clc,
    header,
    success,
    failure,
    warn,
    highlight,
    cmdFmt,
    varFmt,
    questionPrefix
};
