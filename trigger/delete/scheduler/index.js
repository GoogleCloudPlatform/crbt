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

const { success, warn, failure, header, varFmt, clc } = require('../../../lib/colorScheme');
const { getConfig, removeConfigSection } = require('../../../lib/parseConfig');

/**
 * Create a Cloud Scheduler trigger to call the Cloud Run service on an interval.
 * @param {object} options - Initialized from commander.js.
 */
const schedulerDelete = async function(options) {
    console.log(header('\n=== Cloud Scheduler Trigger Deletion\n'));

    let triggerType = getConfig('trigger', 'type');

    if (triggerType === undefined) {
        console.log(failure('No trigger detected. Exiting...'));
        process.exit(1);
    } else if (triggerType !== 'scheduler') {
        console.log(failure('The trigger created is not a Cloud Scheduler trigger. Exiting...'));
        process.exit(1);
    }

    let jobName = getConfig('trigger', 'name');

    let command = ['scheduler', 'jobs', 'delete', jobName, '--quiet'];

    const deleteScheduler = spawn('gcloud', command);
    if (options.verbose) {
        if (deleteScheduler.stdout.toString('utf8') !== '') console.log(deleteScheduler.stdout.toString('utf8'));
        if (deleteScheduler.stderr.toString('utf8') !== '') console.log(deleteScheduler.stderr.toString('utf8'));
    }
    if (deleteScheduler.status === 0) {
        let serviceAccount = getConfig('trigger', 'serviceAccount');
        console.log(success('Cloud Scheduler job deleted: ' + varFmt(jobName)));
        console.log(warn('The following service account was used: ' + varFmt(serviceAccount)));
        console.log(warn('If the service account is no longer needed, remove it manually with: ' + clc.yellow('gcloud iam service-accounts delete ' + serviceAccount)));
        await removeConfigSection('trigger').catch((e) => {});
    } else {
        console.log(failure('Cloud Scheduler job deletion failed.'));
        process.exit(1);
    }
};

module.exports = schedulerDelete;
