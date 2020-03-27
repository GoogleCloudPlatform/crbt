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
const inquirer = require('inquirer');
const spawn = require('child_process').spawnSync;
const dns = require('dns');
const Spinner = require('cli-spinner').Spinner;

const domainDestroy = require('../../destroy/domain/index');
const displayCommand = require('../../lib/displayCommand');
const { saveConfig, getConfig } = require('../../lib/parseConfig');
const { success, warn, failure, header, varFmt, questionPrefix, clc } = require('../../lib/colorScheme');
const { checkFileExists } = require('../../lib/checkPrereqs.js');

let customizationFile = 'app.json';
let configFile = '.crbt';

/**
 * Handle creation of a custom domain mapping for a Cloud Run Service.
 * Feature Overview: https://cloud.google.com/run/docs/mapping-custom-domains
 * @param {object} options - Initialized from commander.js.
 */
const domain = async (options) => {
    return new Promise(async (resolve, reject) => {
        console.log(header('\n=== Domain Mapping Customization\n'));

        // Check if customization specifies mapping, if so then set it (but only check if it's not specified as an argument)
        // Map in customization should only really ever be set if a .crbt was used to restore a service.
        if (options.map == undefined) {
            try {
                options.map = JSON.parse(fs.readFileSync(customizationFile)).mapping;
            } catch (e) {}
        }

        if (checkFileExists(configFile)) {
            options.name = Object.keys(await getConfig('cloudrun'))[0];
            options.region = await getConfig('region');

            // Handle removing all mappings if asked to set mapping to 'none' and mappings already exist.
            let mapping = getConfig('mapping');
            if (options.map === 'none' && Array.isArray(mapping)) {
                await domainDestroy(options);
                await saveConfig('mapping', 'none');
                return resolve();
            }
        } else {
            if (options.name === undefined || options.region === undefined) {
                console.log(failure('No existing configuration (' + varFmt(configFile) + ') and --name/--region undefined. Exiting...'));
                process.exit(1);
            }
        }

        if (options.map === 'none' || options.platform === 'gke') {
            console.log(success('Skipping custom domain setup...'));
            await saveConfig('mapping', 'none');
            return resolve();
        }

        if (options.map) {
            if (checkDomainVerified(options.map)) {
                if (options.map.split('.').length > 2) {
                    // If >2 then it's a subdomain and DNS is handled with CNAME entries, and easy to check DNS is setup properly.
                    if (await checkDNSSetup(options.map).catch((e) => {})) {
                        await createDomainMapping(options.map, options.name, options.region, options.verbose, options.dryrun).catch((e) => {});
                    } else {
                        console.log(failure('The domain chosen does not have DNS configured properly. Please configure a CNAME entry for ' + varFmt(options.map) + ' to ' + varFmt('ghs.googlehosted.com') + ' -- Skipping domain mapping...\n'));
                    }
                } else {
                    // This means its a root domain and has to be handled differently with less automatic checks.
                    console.log(warn('The domain to be mapped is a root domain, and DNS configuration verification cannot be done.'));
                    await createDomainMapping(options.map, options.name, options.region, options.verbose, options.dryrun).catch((e) => {});
                }
            } else {
                console.log(failure('The domain chosen is not verified. This can be done with: gcloud domains verify ' + varFmt('example.com') + '\n'));
            }
            if (!options.dryrun) console.log(success(header('Domain-mapped URL: ') + clc.greenBright.underline('https://' + options.map)));
            return resolve();
        }

        // Check if wanting to use custom domain.
        console.log(warn('You can use a custom domain rather than the default address that Cloud Run provides for a deployed service. This requires a previously verified domain.'));
        // We change message based on entrypoint (if mapping in config is undefined it's from a new initialization, if not then it's a customization)
        let customMapMsgText = 'Do you have a verified domain and want to map it as an entrypoint?';
        if (getConfig('mapping') !== undefined) customMapMsgText = 'Do you have a verified domain and want to map it as an entrypoint (or want to remove all existing mappings)?';
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'customMap',
                    prefix: questionPrefix,
                    message: customMapMsgText,
                    choices: ['Yes', 'No']
                }
            ])
            .then(async (answers) => {
                if (answers.customMap == 'Yes') {
                    options.map = await getMappingAddress();
                    if (options.map == 'none') {
                        // Handle removing all mappings if asked to set mapping to 'none' and mappings already exist.
                        let mapping = getConfig('mapping');
                        if (Array.isArray(mapping)) {
                            await domainDestroy(options);
                            await saveConfig('mapping', 'none');
                            return resolve();
                        } else {
                            console.log(success('No existing domain mappings found, so nothing removed.'));
                            await saveConfig('mapping', 'none');
                            return resolve();
                        }
                    }
                    if (checkDomainVerified(options.map)) {
                        if (options.map.split('.').length > 2) {
                            // If >2 then it's a subdomain and DNS is handled with CNAME entries, and easy to check DNS is setup properly.
                            if (await checkDNSSetup(options.map).catch((e) => {})) {
                                await createDomainMapping(options.map, options.name, options.region, options.verbose, options.dryrun).catch((e) => {});
                            } else {
                                console.log(failure('The domain chosen does not have DNS configured properly. Please configure a CNAME entry for ' + varFmt(options.map) + ' to ' + varFmt('ghs.googlehosted.com') + ' -- Skipping domain mapping...\n'));
                            }
                        } else {
                            // This means its a root domain and has to be handled differently with less automatic checks.
                            console.log(warn('The domain to be mapped is a root domain, and DNS configuration verification cannot be done.'));
                            await createDomainMapping(options.map, options.name, options.region, options.verbose, options.dryrun).catch((e) => {});
                        }
                    } else {
                        console.log(failure('The domain chosen is not verified. This can be done with: ' + clc.yellow('gcloud domains verify ') + varFmt('example.com') + ' -- Skipping domain mapping...\n'));
                    }
                    if (!options.dryrun) console.log(success(header('Domain-mapped URL: ') + clc.greenBright.underline('https://' + options.map)));
                    return resolve();
                } else {
                    console.log(success('Skipping custom domain mapping...'));

                    let mapping = getConfig('mapping');
                    if (mapping === undefined) {
                        await saveConfig('mapping', 'none');
                    }
                    return resolve();
                }
            });
    });
};
/**
 * Prompt user for input of custom address in interactive mode.
 * @returns {string} - Custom domain address.
 */
function getMappingAddress() {
    return new Promise(async (resolve, reject) => {
        // We change message based on entrypoint (if mapping in config is undefined it's from a new initialization, if not then it's a customization)
        let mapAddMsgText = 'What custom domain would you like to add? (Enter `none` to cancel)';
        if (getConfig('mapping') !== undefined) mapAddMsgText = 'What custom domain would you like to add? (Enter `none` to remove all mappings)';
        inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'mappingAddress',
                    prefix: questionPrefix,
                    message: mapAddMsgText
                }
            ])
            .then(async function(answers) {
                return resolve(answers.mappingAddress);
            });
    });
}

/**
 * Confirm the Domain is within the user's verified domains.
 * Feature documentation: https://cloud.google.com/sdk/gcloud/reference/domains/
 * @param {string} domain - Domain address to check.
 * @returns {boolean} - Returns true if Domain is verified.
 */
const checkDomainVerified = function(domain) {
    // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/domains/list-user-verified
    let command = ['domains', 'list-user-verified'];

    let listVerified = spawn('gcloud', command)
        .stdout.toString('utf8')
        .split('\n');
    for (let i = 0; i < listVerified.length; i++) {
        if (listVerified[i] !== '' && domain.includes(listVerified[i])) return true;
    }
    return false;
};

/**
 * Check if hostname has proper DNS CNAME domain set to ghs.googlehosted.com.
 * @param {string} domain - Domain address to check.
 * @returns {boolean} - Returns true if DNS is setup properly.
 */
const checkDNSSetup = function(domain) {
    return new Promise(async (resolve, reject) => {
        dns.resolveCname(domain, (err, addresses) => {
            if (err) return resolve(false);
            if (addresses.includes('ghs.googlehosted.com')) return resolve(true);
            return resolve(false);
        });
    });
};

/**
 * Create the Custom Domain mapping for the Cloud Run service.
 * @param {string} domain - Custom domain address.
 * @param {string} service - Service to bind the address to.
 * @param {string} region - Region the service exists.
 * @param {boolean} verbose - Verbosity.
 * @param {boolean} dryrun - Perform the actions or simply do a dry tun test and display what would be done.
 * @returns {boolean} - True if mapping is successful.
 */
const createDomainMapping = function(domain, service, region, verbose, dryrun) {
    return new Promise(async (resolve, reject) => {
        // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/domains/list-user-verified
        let command = ['beta', 'run', 'domain-mappings', 'create', '--service', service, '--domain', domain, '--platform', 'managed', '--region', region];

        if (dryrun) {
            displayCommand('gcloud', command);

            let mapping = getConfig('mapping');
            if (Array.isArray(mapping)) {
                mapping.push(domain);
            } else {
                mapping = [];
                mapping.push(domain);
            }
            await saveConfig('mapping', mapping);
            return resolve(true);
        }

        const mapDomain = spawn('gcloud', command);

        if (verbose) {
            if (mapDomain.stdout.toString('utf8') !== '') console.log(mapDomain.stdout.toString('utf8'));
            if (mapDomain.stderr.toString('utf8') !== '') console.log(mapDomain.stderr.toString('utf8'));
        }

        if (mapDomain.status === 0) {
            console.log(success('Successfully mapped ' + varFmt(service) + ' to ' + varFmt(domain)));
            let mapping = getConfig('mapping');
            if (Array.isArray(mapping)) {
                mapping.push(domain);
            } else {
                mapping = [];
                mapping.push(domain);
            }

            await saveConfig('mapping', mapping);

            if (domain.split('.').length === 2) {
                // If 2 then it's a root domain that needs IP mapping versus CNAME.
                console.log(warn('Please follow the steps within ' + varFmt('https://cloud.google.com/run/docs/mapping-custom-domains#dns_update') + ' to setup DNS. After completion, Cloud Run will provision an SSL certificate for the domain.'));
                console.log(warn('Until DNS is setup and an SSL certificate is automatically provisioned, the domain mapping will not work.'));
                return resolve(true);
            } else {
                let spinner = new Spinner(warn('Waiting for certificate provisioning... %s '));
                spinner.setSpinnerString('|/-\\');
                spinner.start();

                let certProvisioned = false;
                while (!certProvisioned) {
                    certProvisioned = true;
                    // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/beta/run/services/
                    let checkMapping = spawn('gcloud', ['beta', 'run', 'domain-mappings', 'describe', '--domain', domain, '--platform', 'managed', '--region', region])
                        .stdout.toString('utf8')
                        .split('\n');
                    for (let i = 0; i < checkMapping.length; i++) {
                        if (checkMapping[i].includes('Waiting for certificate')) certProvisioned = false;
                    }
                    if (certProvisioned) {
                        spinner.stop();
                        console.log('\n');
                        certProvisioned = true;
                        console.log(success('Certificate successfully provisioned.'));
                        return resolve(true);
                    }
                    await sleep(3000); // Sleep for 3 seconds between checks just to avoid spamming requests.
                }
            }
        } else {
            console.log(failure('Failed to map ' + varFmt(service) + ' to ' + varFmt(domain) + '\n'));
            return resolve(false);
        }
    });
};

/**
 * Helper function to put some sleep time in the code. Useful for helping to prevent spamming external services.
 * @param {integer} ms
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

module.exports = domain;
