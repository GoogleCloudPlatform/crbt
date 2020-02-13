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
const customize = require('./customize/index');
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
    .option('-m, --map [domain]', 'Map a custom domain to the service (platform-specific: managed)')
    .option('-e, --existing', 'Allow existing files to exist in the project directory')
    .option('-d, --dryrun', 'Only show commands and save configuration, but do not execute them in GCP')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        initialize(options);
    });

// This command runs Cloud Build directly; this is primarily used when a Cloud Build trigger wasn't created to automatically run it.
program
    .command('deploy')
    .description('Build and deploy services')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        deploy(options);
    });

// Parse the config file and return it in a human readable YAML-style format to show the status.
program
    .command('status')
    .description('Print status')
    .action(() => {
        status();
    });

// List available templates (used if using a template as a base for source code).
program
    .command('list')
    .description('List available templates')
    .action(() => {
        list();
    });

// Handle customization of the service, specifically relating to environment variables currently. This can be called directly via `crbt customize` or as part of the init process.
program
    .command('customize')
    .description('Reconfigure environment variables for the service')
    .option('-n, --name [name]', 'Application name (default: current directory name)')
    .option('-r, --region [region]', 'GCP Region [asia-northeast1, europe-west1, us-central1, us-east1]')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        customize(options, true);
    });

// Handle destruction of services previously created. Only runs if the current directory has a .crbt file and utilizes that to determine what to remove.
program
    .command('destroy')
    .description('Destroy all enabled services from the current directory')
    .option('-y, --yes', 'Confirm destroying entire project with no prompts.')
    .option('-p, --preserve', "Don't delete .crbt config")
    .option('-r, --repo [repo]', 'Override and specify CSR repo to delete.')
    .option('-v, --verbose', 'Verbose mode')
    .action((options) => {
        destroy(options);
    });

program.parse(process.argv);

// If no arguments passed.
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
