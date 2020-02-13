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

const fs = require('fs');
const path = require('path');

const { clc } = require('../lib/colorScheme');

/**
 * List available templates.
 */
const list = async function() {
    const TEMPLATE_ROOT = path.resolve(__dirname, '../templates/');
    const templateList = await populateTemplateList(TEMPLATE_ROOT + '/cloudrun/');
    console.log('Templates available: ');
    for (let template in templateList) {
        console.log(clc.yellow('- ') + templateList[template]);
    }
};

/**
 * Populates the list of templates based on folder names inside templates/cloudrun/
 * @param {string} folder - Path to templates.
 * @return {array} - Return the list of templates.
 */
function populateTemplateList(folder) {
    return new Promise((resolve, reject) => {
        fs.readdir(folder, function(err, files) {
            if (err) {
                return reject();
            } else {
                return resolve(files);
            }
        });
    });
}

module.exports = { list, populateTemplateList };
