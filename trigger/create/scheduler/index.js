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

const spawn = require('child_process').spawnSync;
const inquirer = require('inquirer');
const enableAPI = require('../../../lib/enableAPI');

const displayCommand = require('../../../lib/displayCommand');
const { success, warn, failure, header, questionPrefix, varFmt, clc } = require('../../../lib/colorScheme');
const { saveConfig, getConfig } = require('../../../lib/parseConfig');

/**
 * Create a Cloud Scheduler trigger to call the Cloud Run service on an interval.
 * @param {object} options - Initialized from commander.js.
 */
const schedulerCreate = async function(options) {
    console.log(header('\n=== Cloud Scheduler Trigger Creation\n'));

    let serviceName = getConfig('name');
    let serviceUrl = getConfig('cloudrun', serviceName);
    let platform = getConfig('platform');
    let project = getConfig('project', 'name');
    let allowUnauthenticated = getConfig('options', 'allow-unauthenticated');

    // We rely on this being a crbt project for configuration parameters.
    if (serviceName === undefined || allowUnauthenticated === undefined || serviceName === undefined || platform === undefined || project === undefined || serviceUrl === undefined) {
        console.log(failure('Unable to detect all necessary values within configuration. Make sure service was initialized properly with crbt. Exiting...'));
        process.exit(1);
    }
    let region;
    let cluster;
    let clusterzone;
    if (platform === 'managed') {
        region = getConfig('region');
        if (region === undefined) {
            console.log(failure('Unable to detect all necessary values within configuration. Make sure service was initialized properly with crbt. Exiting...'));
            process.exit(1);
        }
    } else if (platform === 'gke') {
        cluster = getConfig('cluster');
        clusterzone = getConfig('clusterzone');
        if (cluster === undefined || clusterzone === undefined) {
            console.log(failure('Unable to detect all necessary values within configuration. Make sure service was initialized properly with crbt. Exiting...'));
            process.exit(1);
        }
        // We need to define a region for the App Engine app location.
        region = clusterzone.split('-')[0] + '-' + clusterzone.split('-')[1]; // TODO: Use splice() instead.
    }

    // From a crbt perspective, we only want to support 1 trigger (excluding regular HTTP trigger).
    if (getConfig('trigger') !== undefined) {
        console.log(warn('crbt only supports creating one (1) trigger. Additional triggers can be created manually without crbt.'));
        console.log(failure('Existing trigger has already been created. Exiting...'));
        process.exit(1);
    }

    // Enable the Cloud Scheduler and App Engine APIs
    enableAPI('cloudscheduler', options.dryrun, options.verbose);
    enableAPI('appengine', options.dryrun, options.verbose);

    // Check & enable App Engine app which is required for Cloud Scheduler
    checkAppEngineApp(region, options.verbose);

    // If unauthenticated invocations are not allowed, we have to use a service account to invoke the service.
    if (allowUnauthenticated === false) {
        if (!options.account) options.account = await determineServiceAccount();
        else console.log(success('Using service account: ') + varFmt(options.account));

        // Convert simple name to full email-based name.
        options.account = options.account + '@' + project + '.iam.gserviceaccount.com';

        await checkServiceAccount(options.account, options.verbose, options.dryrun);

        let iamCommand;
        if (platform === 'managed') {
            iamCommand = ['run', 'services', 'add-iam-policy-binding', serviceName, '--member=serviceAccount:' + options.account, '--role=roles/run.invoker', '--platform=managed', '--region=' + region];
        } else if (platform === 'gke') {
            iamCommand = ['run', 'services', 'add-iam-policy-binding', serviceName, '--member=serviceAccount:' + options.account, '--role=roles/run.invoker', '--platform=gke', '--cluster=' + cluster, '--cluster-location=' + clusterzone];
        }
        if (options.dryrun) {
            displayCommand('gcloud', iamCommand);
        } else {
            const iamCreate = spawn('gcloud', iamCommand);
            if (options.verbose) {
                if (iamCreate.stdout.toString('utf8') !== '') console.log(iamCreate.stdout.toString('utf8'));
                if (iamCreate.stderr.toString('utf8') !== '') console.log(iamCreate.stderr.toString('utf8'));
            }
            if (iamCreate.status === 0) {
                console.log(success('Cloud Run IAM Policy Binding added (' + varFmt(options.account) + '): ' + varFmt('roles/run.invoker')));
            } else {
                console.log(failure('Cloud Run IAM Policy Binding failed.'));
                process.exit(1);
            }
        }
    } else {
        console.log(warn('Cloud Run service is configured to allow unauthenticated invocations, therefore skipping service account authentication...'));
    }

    let jobName = 'scheduler-' + serviceName;
    if (!options.schedule) options.schedule = await determineSchedule();
    else console.log(success('Using schedule: ') + varFmt(options.schedule));

    if (!options.method) options.method = await determineHttpMethod();
    else console.log(success('Using method: ') + varFmt(options.method));

    // If HTTP method is PUT or POST, determine what message body to pass.
    if (options.method === 'PUT' || options.method === 'POST') {
        if (!options.body) options.body = await determineMessageBody();
        else console.log(success('Using message body: ') + varFmt(options.body));
    }

    let schedulerCommand = ['scheduler', 'jobs', 'create', 'http', jobName, '--schedule', options.schedule, '--uri=' + serviceUrl, '--http-method=' + options.method];
    if (options.body) schedulerCommand.push('--message-body=' + options.body);
    if (allowUnauthenticated === false) {
        schedulerCommand.push('--oidc-service-account-email=' + options.account);
        schedulerCommand.push('--oidc-token-audience=' + serviceUrl);
    }
    schedulerCommand.push('--quiet');

    if (options.dryrun) {
        displayCommand('gcloud', schedulerCommand);
    } else {
        const createScheduler = spawn('gcloud', schedulerCommand);
        if (options.verbose) {
            if (createScheduler.stdout.toString('utf8') !== '') console.log(createScheduler.stdout.toString('utf8'));
            if (createScheduler.stderr.toString('utf8') !== '') console.log(createScheduler.stderr.toString('utf8'));
        }
        if (createScheduler.status === 0) {
            console.log(success('Cloud Scheduler trigger created.'));
            await saveConfig('trigger', 'serviceAccount', options.account);
            await saveConfig('trigger', 'name', jobName);
            await saveConfig('trigger', 'type', 'scheduler');
        } else {
            console.log(failure('Cloud Scheduler trigger failed.'));
            process.exit(1);
        }
    }
};

/**
 * @returns {boolean} - App found true/false.
 */
function checkAppEngineApp(region, verbose) {
    return new Promise(async (resolve, reject) => {
        let command = ['app', 'describe'];

        const checkAppEngine = spawn('gcloud', command);
        if (verbose) {
            if (checkAppEngine.stdout.toString('utf8') !== '') console.log(checkAppEngine.stdout.toString('utf8'));
            if (checkAppEngine.stderr.toString('utf8') !== '') console.log(checkAppEngine.stderr.toString('utf8'));
        }
        if (checkAppEngine.status === 0) {
            console.log(success('App Engine app found.'));
            return resolve();
        } else {
            console.log(warn('App Engine app not found (required for Cloud Scheduler). Attempting to create...'));
            enableAppEngineApp(region, verbose);
            return resolve();
        }
    });
}

function enableAppEngineApp(region, verbose) {
    // App Engine locations have a few anomalies (i.e. us-central1 is us-central, and europe-west1 is europe-west) that we need to account for.
    if (region === 'us-central1') region = 'us-central';
    if (region === 'europe-west1') region = 'europe-west';

    let command = ['app', 'create', '--region=' + region];

    const createAppEngineApp = spawn('gcloud', command);
    if (verbose) {
        if (createAppEngineApp.stdout.toString('utf8') !== '') console.log(createAppEngineApp.stdout.toString('utf8'));
        if (createAppEngineApp.stderr.toString('utf8') !== '') console.log(createAppEngineApp.stderr.toString('utf8'));
    }
    if (createAppEngineApp.status === 0) {
        console.log(warn('App Engine app created in: ' + varFmt(region)));
        return;
    } else {
        console.log(failure('Creating App Engine app failed.'));
        process.exit(1);
    }
}

/**
 * Check to see if a service account already exists.
 * @param {string} serviceAccountToCheck - Service account name.
 * @param {boolean} verbose - Verbosity.
 * @param {boolean} dryrun - Perform the actions or simply do a dry tun test and display what would be done.
 */
function checkServiceAccount(serviceAccountToCheck, verbose, dryrun) {
    return new Promise(async (resolve, reject) => {
        let command = ['iam', 'service-accounts', 'list', '--format=json'];

        const getServiceAccounts = spawn('gcloud', command);
        if (verbose) {
            if (getServiceAccounts.stdout.toString('utf8') !== '') console.log(getServiceAccounts.stdout.toString('utf8'));
            if (getServiceAccounts.stderr.toString('utf8') !== '') console.log(getServiceAccounts.stderr.toString('utf8'));
        }
        if (getServiceAccounts.status === 0) {
            let serviceAccountList = JSON.parse(getServiceAccounts.stdout);
            for (let account in serviceAccountList) {
                if (serviceAccountList[account].email === serviceAccountToCheck) {
                    console.log(success('Service account (' + varFmt(serviceAccountToCheck) + ') found.'));
                    return resolve();
                }
            }
            console.log(warn('Service account not found. Attempting to create...'));
            await createServiceAccount(serviceAccountToCheck, verbose, dryrun);
            return resolve();
        } else {
            console.log(failure('Checking if service account exists failed.'));
            process.exit(1);
        }
    });
}

/**
 * Create a service account that will be used to invoke the Cloud Run service.
 * @param {string} serviceAccount - Service account name.
 * @param {boolean} verbose - Verbosity.
 * @param {boolean} dryrun - Perform the actions or simply do a dry tun test and display what would be done.
 */
function createServiceAccount(serviceAccount, verbose, dryrun) {
    return new Promise(async (resolve, reject) => {
        let serviceName = getConfig('name');

        let command = ['iam', 'service-accounts', 'create', serviceName + '-invoker', '--display-name="Invoker for ' + serviceName + ' Cloud Run Service"'];

        const accountCreate = spawn('gcloud', command);
        if (verbose) {
            if (accountCreate.stdout.toString('utf8') !== '') console.log(accountCreate.stdout.toString('utf8'));
            if (accountCreate.stderr.toString('utf8') !== '') console.log(accountCreate.stderr.toString('utf8'));
        }
        if (accountCreate.status === 0) {
            console.log(success('Service Account created: ') + varFmt(serviceAccount));
            return resolve();
        } else {
            console.log(failure('Creating Service Account failed.'));
            process.exit(1);
        }
    });
}

/**
 * Ask the user for which service account for Cloud Scheduler to use to invoke the Cloud Run service. Only used if allow-unauthenticated is set to false on the Cloud Run service.
 * @returns {string} - Name of the service account.
 */
function determineServiceAccount() {
    return new Promise(async (resolve, reject) => {
        inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'serviceAccount',
                    prefix: questionPrefix,
                    message: 'What service account would you like to use (name only, not email)?'
                }
            ])
            .then(async function(answers) {
                // Do some very basic checking to see if it's just the name and not the full email.
                if (answers.serviceAccount.includes('@')) {
                    console.log(failure('Invalid service account name.'));
                    process.exit(1);
                }
                return resolve(answers.serviceAccount);
            });
    });
}

/**
 * Ask the user for their desired Cloud Scheduler schedule.
 * @returns {string} - Returns a cron string.
 */
function determineSchedule() {
    return new Promise(async (resolve, reject) => {
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'interval',
                    prefix: questionPrefix,
                    message: 'What schedule interval would you like to use?',
                    choices: ['every minute', 'every 5 minutes', 'hourly', 'daily (midnight)', 'custom']
                }
            ])
            .then(async function(answers) {
                if (answers.interval === 'every minute') return resolve('*/1 * * * *');
                else if (answers.interval === 'every 5 minutes') return resolve('*/5 * * * *');
                else if (answers.interval === 'hourly') return resolve('0 * * * *');
                else if (answers.interval === 'daily (midnight)') return resolve('0 0 * * *');
                else if (answers.interval === 'custom') return resolve(await determineCustomInterval());
            });
    });
}

/**
 * Ask user for their custom Cloud Scheduler interval (this is prompted if a default option is not selected.)
 * @returns {string} - Returns a cron string.
 */
function determineCustomInterval() {
    return new Promise(async (resolve, reject) => {
        console.log();
        console.log(warn('Custom interval must be in unix-cron format. More information:'));
        console.log(warn('\t- Cloud Scheduler Documentation: ' + clc.blue('https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules#defining_the_job_schedule')));
        console.log(warn('\t- crontab manual page: ' + clc.blue('http://man7.org/linux/man-pages/man5/crontab.5.html\n')));
        inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'customInterval',
                    prefix: questionPrefix,
                    message: 'What custom interval would you like to use?'
                }
            ])
            .then(async function(answers) {
                // Do some very basic checking to see if it's in unix-cron format.
                if (answers.customInterval.split(' ').length === 5) return resolve(answers.customInterval);
                else {
                    console.log(failure('Invalid cron format.'));
                    process.exit(1);
                }
            });
    });
}

/**
 * Ask the user which HTTP method to use to invoke the Cloud Run service.
 * @returns {string} - HTTP method type.
 */
function determineHttpMethod() {
    return new Promise(async (resolve, reject) => {
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'method',
                    prefix: questionPrefix,
                    message: 'What HTTP Method would you like to use to call the Cloud Run service?',
                    choices: ['GET', 'POST', 'PUT']
                }
            ])
            .then(async function(answers) {
                return resolve(answers.method);
            });
    });
}

/**
 * Ask the user what message body to send to the Cloud Run service (if using HTTP Method of PUT or POST).
 * @returns {string} - Message body.
 */
function determineMessageBody() {
    return new Promise(async (resolve, reject) => {
        inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'messageBody',
                    prefix: questionPrefix,
                    message: 'What data payload do you want included as the body of the HTTP request?'
                }
            ])
            .then(async function(answers) {
                return resolve(answers.messageBody);
            });
    });
}

module.exports = schedulerCreate;
