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

const prettyjson = require('prettyjson');

const { getConfig } = require('../lib/parseConfig');
const { failure } = require('../lib/colorScheme');

/*
Example output of config through `status`:
    repo:
      name: appname
    project:
      name:   es-crtest1
      region: us-east1
    cloudbuild:
      appname-trigger:         69f919ae-cce6-48c2-918a-cd65c206a66c
      appname-backend-trigger: ff4a9dd4-8c58-46b2-b457-38e24fe33e4b
    cloudrun:
      appname:
        url:
          frontend: https://appname-4a4srvftaq-ue.a.run.app
          backend:  null
      appname-backend:
        url:
          frontend: https://appname-4a4srvftaq-ue.a.run.app
          backend:  https://appname-backend-4a4srvftaq-ue.a.run.app
*/

/**
 * Parse the config file and return it in a human readable YAML-style format.
 */
const status = async function() {
    try {
        let data = await getConfig();
        console.log(
            prettyjson.render(data, {
                keysColor: 'magenta',
                stringColor: 'white'
            })
        );
    } catch (e) {
        console.log(failure('No configuration file (.crbt) detected.'));
        process.exit(1);
    }
};

module.exports = status;
