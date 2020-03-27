#!/usr/bin/env node

/*
Copyright 2019 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

const program = require('commander');
const packagejson = require('./package.json');
const initialize = require('./init/index');
const deploy = require('./deploy/index');
const destroy = require('./destroy/index');
const status = require('./status/index');
const envvars = require('./customize/envvars/index');
const domain = require('./customize/domain/index');
const schedulerCreate = require('./trigger/create/scheduler/index');
const schedulerDelete = require('./trigger/delete/scheduler/index');
const { list } = require('./list/index');

// Options
program.version(packagejson.version);

// Entry point to handle initialization of what to create. Definition of what to create can be done interactively or non-interactively (through cli arguments).
program
    .command('init')
    .description('Initialize an application into the current directory')
    .option('-n, --name [name]', 'Application name (default: current directory name)')
    .option('-p, --platform [platform]', 'Deploy to Cloud Run (managed) or Cloud Run on Anthos on Google Cloud [managed, gke]')
    .option('-r, --region [region]', 'GCP Region (platform-specific: managed) [asia-northeast1, europe-west1, us-central1, us-east1]')
    .option('-c, --cluster [name]', 'GKE Cluster to use (platform-specific: gke)')
    .option('-z, --clusterzone [zone]', 'GKE Cluster location to use (platform-specific: gke)')
    .option('-t, --template [template]', 'Cloud Run template to utilize [Run `crbt list` for options]')
    .option('-s, --sourcerepo [sourcerepo]', 'Git repository URL for project source to copy')
    .option('-l, --local', 'Use local source within current directory')
    .option('-b, --build [trigger]', 'Use Cloud Build build trigger [commit, none]')
    .option('-m, --map [domain]', 'Map a custom domain to the service (platform-specific: managed) [<domain>, none]')
    .option('-e, --existing', 'Allow existing files to exist in the project directory')
    .option('-d, --dryrun', 'Only show commands and save configuration, but do not execute them in GCP')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        initialize(options);
    });

// Handle customization of the service's environment variables.
program
    .command('customize:envvars')
    .description('Reconfigure environment variables for the service')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        envvars(options, true);
    });

// Handle customization of the service's domain mapping.
program
    .command('customize:domain')
    .description('Reconfigure domain name mapping for the service')
    .option('-m, --map [domain]', 'Map a custom domain to the service (platform-specific: managed) [<domain>, none]')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        domain(options, true);
    });

// This command runs Cloud Build directly; this is primarily used when a Cloud Build trigger wasn't created to automatically run it.
program
    .command('deploy')
    .description('Build and deploy services')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        deploy(options);
    });

// Handle destruction of services previously created. Only runs if the current directory has a .crbt file and utilizes that to determine what to remove.
program
    .command('destroy')
    .description('Destroy all enabled services from the current directory')
    .option('-y, --yes', 'Confirm destroying entire project with no prompts')
    .option('-p, --preserve', "Don't delete .crbt config")
    .option('-r, --repo [repo]', 'Override and specify CSR repo to delete')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        destroy(options);
    });

// List available templates (used if using a template as a base for source code).
program
    .command('list')
    .description('List available templates')
    .action(() => {
        list();
    });

// Parse the config file and return it in a human readable YAML-style format to show the status.
program
    .command('status')
    .description('Print status')
    .action(() => {
        status();
    });

// This command creates a Cloud Scheduler job to trigger the Cloud Run service.
program
    .command('trigger:create:scheduler')
    .description('Create a new Cloud Scheduler trigger for the Cloud Run service')
    .option('-s, --schedule [schedule]', 'Schedule on which the job will be executed. (unix-cron format)')
    .option('-m, --method [method]', 'HTTP method to use for the request [GET, PUT, POST]')
    .option('-b, --body [message]', 'Data payload to be included as the body of the HTTP request. (only valid for PUT, POST methods)')
    .option('-a, --account [service account]', 'Service account used to authenticate to the Cloud Run service (name only, not email)')
    .option('-d, --dryrun', 'Only show commands, but do not execute them in GCP')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        schedulerCreate(options);
    });

// This command deletes a Cloud Scheduler job that was used to trigger the Cloud Run service.
program
    .command('trigger:delete:scheduler')
    .description('Delete a Cloud Scheduler trigger for the Cloud Run service')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        schedulerDelete(options);
    });

program.parse(process.argv);

// If no arguments passed.
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
