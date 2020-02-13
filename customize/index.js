#!/usr/bin/env node
/**
 * Copyright 2020 Google LLC
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
const inquirer = require('inquirer');
const spawn = require('child_process').spawnSync;

const { success, warn, failure, header, questionPrefix, varFmt, clc } = require('../lib/colorScheme');
const { checkFileExists } = require('../lib/checkPrereqs.js');
const { saveConfig, getConfig } = require('../lib/parseConfig');

let customizationFile = 'app.json';
let configFile = '.crbt';

/**
 * Handle customization of the service, specifically relating to environment variables currently. This can be called directly via `crbt customize` or as part of the init process.
 * @param {object} options - Initialized from commander.js.
 * @param {Boolean} rePrompt - Force re-prompting for set variables (i.e. if the app.json specifies a value versus an object). This is always true when ran from `crbt customize`.
 */
const customize = async (options, rePrompt) => {
    return new Promise(async (resolve, reject) => {
        console.log(header('\n=== Customization Configuration\n'));

        if (checkFileExists(customizationFile) === false) {
            console.log(warn('No customization file ' + varFmt(customizationFile) + ' detected. Skipping...'));
            return resolve();
        }

        let jsonCustomization = {};
        try {
            jsonCustomization = JSON.parse(fs.readFileSync(customizationFile));
        } catch (e) {
            console.log(failure('Customization file ' + varFmt(customizationFile) + ' detected, but unable to parse.'));
            return resolve();
        }

        if (checkFileExists(configFile)) {
            options.name = Object.keys(await getConfig('cloudrun'))[0];
            options.region = await getConfig('region');
        } else {
            if (options.name === undefined || options.region === undefined) {
                console.log(failure('No existing configuration (' + varFmt(configFile) + ') and --name/--region undefined. Exiting...'));
                process.exit(1);
            }
        }

        let customEnvVariables = jsonCustomization['env'];

        if (customEnvVariables == undefined) {
            console.log(warn('No environment variable configuration found. Skipping...'));
            return resolve();
        } else {
            console.log(success('Environment variable configuration found.'));

            let envVariables = {};

            for (let customEnvVar in customEnvVariables) {
                if (typeof customEnvVariables[customEnvVar] !== 'object' && !rePrompt) {
                    // If it's not an object, then just set it as the value. Implemented to handle rebuild from .crbt file.
                    envVariables[customEnvVar] = customEnvVariables[customEnvVar];
                    await saveConfig('env', customEnvVar, envVariables[customEnvVar]);
                } else {
                    let envPrompt = 'Please enter a value for the environment variable ' + varFmt(customEnvVar);
                    if (customEnvVariables[customEnvVar].description !== undefined) envPrompt += ' (' + customEnvVariables[customEnvVar].description + ')';

                    let configValue;
                    try {
                        configValue = await getConfig('env', customEnvVar);
                    } catch (e) {}

                    if (customEnvVariables[customEnvVar].value !== undefined) envPrompt += ' [' + clc.yellow('Default') + ': ' + varFmt(customEnvVariables[customEnvVar].value) + ']';
                    if (configValue) envPrompt += ' [' + clc.yellow('Current') + ': ' + varFmt(configValue) + ']';

                    envPrompt += ': ';

                    let answer = '';
                    while (answer == '') {
                        answer = await promptEnv(envPrompt);
                        if (answer == '') {
                            if (configValue) answer = configValue;
                            else if (customEnvVariables[customEnvVar].value) answer = customEnvVariables[customEnvVar].value;
                        }
                        if (!customEnvVariables[customEnvVar].required) break;
                        else console.log(warn('Environment variable requires a value.'));
                    }

                    envVariables[customEnvVar] = answer;
                    await saveConfig('env', customEnvVar, answer);
                    console.log();
                }
            }

            var envArg = '';
            for (let envVar in envVariables) {
                envArg += envVar + '=' + envVariables[envVar] + ',';
            }

            console.log(warn('Running update for service (' + varFmt(options.name) + ')...'));
            let command = ['beta', 'run', 'services', 'update', options.name, '--set-env-vars', envArg, '--platform', 'managed', '--region', options.region];
            const envCreate = spawn('gcloud', command);

            if (options.verbose) {
                if (envCreate.stdout.toString('utf8') !== '') console.log(envCreate.stdout.toString('utf8'));
                if (envCreate.stderr.toString('utf8') !== '') console.log(envCreate.stderr.toString('utf8'));
            }
            if (envCreate.status === 0) {
                console.log(success('Environment variables added to service.'));
                return resolve();
            } else {
                console.log(failure('Failed to add environment variables to service!'));
                return reject();
            }
        }
    });
};

/**
 * Helper function to prompt using Inquirer.js
 * @param {String} envPrompt - The text message for the prompt.
 * @returns {String} - User inputted value.
 */
function promptEnv(envPrompt) {
    return new Promise(async (resolve, reject) => {
        inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'varSetting',
                    prefix: questionPrefix,
                    message: envPrompt
                }
            ])
            .then(async function(answers) {
                return resolve(answers.varSetting);
            });
    });
}

module.exports = customize;
