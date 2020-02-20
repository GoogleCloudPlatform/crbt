# crbt ![Node Version](https://img.shields.io/static/v1?label=node&message=%3E10&color=brightgreen) ![Google Cloud SDK Version](https://img.shields.io/static/v1?label=GoogleCloudSDK&message=%3E272.0.0&color=blue)

**Note: This tool is not officially part of the Cloud Run product and provided as-is as a convenience utility for getting started. Google does not guarantee long-term maintenance for this project.**

(c)loud (r)un (b)ootstrap (t)ool can be used to simplify initialization of Cloud Run applications along with supporting Google Cloud services. The core goal of crbt is to provide a super easy way to setup a Cloud Run project that has source code management and CI/CD so that you can just focus on your code (and will even give you some template code to get you started, if desired).

Another important aspect is that everything should be able to be set up interactively to make it really simple to use (no need to memorize flags or parameters), but also to provide non-interactive usage for advanced usage (like providing the ability to redeploy your services the exact same way to other GCP projects).

Everything crbt does can be performed manually without crbt, as the tool wraps around the [Google Cloud SDK Command-line interface](https://cloud.google.com/sdk/). In fact, executing crbt with `--dryrun` will show you exactly what you'd need to execute yourself, if you prefer!

**Disclaimer: This is not an officially supported Google project.**

### What does it do?

Beyond the Cloud Run service deployment itself, crbt can perform the following:

-   Setup [Cloud Source Repository](https://cloud.google.com/source-repositories/) for source code management.
-   Setup and configure [Cloud Build](https://cloud.google.com/cloud-build/) for automated container builds into [Container Registry](https://cloud.google.com/container-registry/) upon code commit to [Cloud Source Repository](https://cloud.google.com/source-repositories/).
-   Setup and configure [Cloud Build](https://cloud.google.com/cloud-build/) for automated service deployments upon code commit to [Cloud Source Repository](https://cloud.google.com/source-repositories/).

For the Cloud Run service deployment, crbt can perform the following:

-   Create [Cloud Run](https://cloud.google.com/run/) service from scratch.
-   Setup [Custom Domain Mapping](https://cloud.google.com/run/docs/mapping-custom-domains) to allow Custom URLs to the service (e.g. `https://service.example.com` instead of `https://service-esjxjixyz-ue.a.run.app`).
-   Configure the service according to settings defined with an `app.json` customization file, including environment variables, options, and more.

It also provides functionality to:

-   Provide automatic clean up of all deployed services and artifacts to retire the service.
-   Interactively create an `app.json` file that can be used to non-interactive re-deploy the service.
-   Redeploy the service and supporting services (including across other projects) by utilizing the `.crbt` configuration file.
-   Create triggers using services like [Cloud Scheduler](https://cloud.google.com/scheduler) to invoke the service.

### How can I use it?

crbt can be ran three separate ways:

-   **Interactively**: crbt will provide helpful tips and defaults to interactively guide you through setting everything up, including providing sample teplates for you to base your project on.
-   **Non-interactively through Command-Line Flags & Arguments**: Anything that is prompted for interactively can be set through command-line flags (e.g. `--region us-east1`).
-   **Non-interactively through `app.json`**: Anything that is prompted for interactively can be set through the `app.json` customization JSON file.

crbt can also deploy source code three separate ways:

-   **From Template**: Several example templates are built-in to the tool for a base to get you started with your project.
-   **From Git Repository**: You can point crbt to a Git Repository\* and it will clone it, set everything up, and deploy it .
-   **From Local Source**: If you already have code for a service, you can set everything up around it and deploy it with crbt.

_[*]:_ The code should be a Cloud Run service respecting the official [Code Requirements](https://cloud.google.com/run/docs/developing#code_requirements).

### Can you show me a quick example?

Sure!

#### First, the initialization inside an entirely new project:

![Example usage of `crbt init`](https://github.com/GoogleCloudPlatform/crbt/raw/master/assets/crbt_init.gif)

Well, that seemed simple... what all did we do behind the scenes?

1. Enabled Google Cloud service APIs for: Cloud Source Repositories, Cloud Build, and Cloud Run.
2. Created a new Cloud Source Repository code repository.
3. Initialized the newly created repository within our current directory
4. Created a cloudbuild.yaml file to tell Cloud Build how to build our container image, push the container image to Container Registry, and then to deploy the container to Cloud Run.
5. Updated the cloudbuild.yaml file with configuration for the service name, path, region, and service options.
6. Created the IAM policy bindings to allow the Cloud Build service account to manage the Cloud Run service.
7. Created a Cloud Build trigger that looks for commits to the master branch.
8. Commited and pushed the source code to Cloud Source Repositories.
9. Waited for Cloud Build to finish deployment, then grabbed the URL and displayed it.
10. Provisioned a domain mapping to give the service a custom URL.
11. Waited for the domain to map and SSL certificate to apply, and then displayed the new URL.

We also:

1. Performed sanity checks of inputs
2. Saved the configuration to file: `.crbt`
3. Performed error checking
4. Gave an easy wait to clean all this up with: `crbt destroy`

Cool, but what if I didn't want to do that interactively, but use those same parameters in the example? We could've ran: `crbt init --template web-expressjs-helloworld --build commit --region us-east1 --map jan19-01.esquared.dev`

#### Now that's done, let's get to coding -- then let the automatic build process that crbt created take care of the update process after commit:

![Example of automatic update](https://github.com/GoogleCloudPlatform/crbt/raw/master/assets/crbt_update.gif)

#### Let's clean it all up and remove the services we created:

![Example of `crwt destroy`](https://github.com/GoogleCloudPlatform/crbt/raw/master/assets/crbt_destroy.gif)

See more examples in the [Examples](#Examples) section below..

## Installation

### Releases

Binaries are available through [Releases](https://github.com/GoogleCloudPlatform/crbt/releases).

### Testing

First you will need to install [Node.js](http://nodejs.org/) and [npm](https://npmjs.org/). Installing Node.js should install npm as well.

Execute the following commands to setup for testing purposes (creates symlink):

```
npm install
npm link
```

The `crbt` command should now be accessible.

### Standalone Binary

First you will need to install [Node.js](http://nodejs.org/) and [npm](https://npmjs.org/). Installing Node.js should install npm as well.

Execute the following command to build a standalone binary:  
`npm run package`

A `crbt` binary will be placed inside the `bin/` folder. Call it directly or place it with in your system path (e.g. `cp bin/crbt /usr/local/bin/`).

## Usage

The command `crbt --help` lists the available commands and `crbt <command> --help` shows more details for an individual command.

Below is a brief list of the available commands and their function:

### Commands

| Command                      | Description                                                                                                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **init**                     | Setup a new application in the current directory. This command will create a `crbt.conf` configuration file in your current directory. It will also look for an `app.json` for customization parameters.                                            |
| **customize**                | Re-parse the `app.json` file, and re-prompt for environment variables.                                                                                                                                                                              |
| **deploy**                   | Deploys the Cloud Run service within the current directory. Relies on a `cloudbuild.yaml` file and the local project directory. This is the method to deploy the service if automatic Cloud Build triggers were not selected during initialization. |
| **destroy** [feature]        | Destroys deployed services, but does not delete local code. [feature] can be `all` (Default) or `cloudrun`.                                                                                                                                         |
| **list**                     | List available built-in templates for Cloud Run services.                                                                                                                                                                                           |
| **status**                   | Output current configuration status.                                                                                                                                                                                                                |
| **trigger:create:scheduler** | Create a new Cloud Scheduler trigger for the Cloud Run service.                                                                                                                                                                                     |
| **trigger:delete:scheduler** | Delete a Cloud Scheduler trigger for the Cloud Run service.                                                                                                                                                                                         |
| **help**                     | Display help information about the CLI or specific commands.                                                                                                                                                                                        |

### Command Options

Below is a brief list of each command's options:

#### init

Usage without all flags defined (either through command-line arguments or `app.json`) will interactively prompt for unconfigured flags. The flags `--local`, `--sourcerepo`, and `--template` define where the source code should come from, and these are mutually exclusive. Some options are specific to the platform location (e.g. `managed` or `gke`).

| Option                         | Description                                                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **-n, --name** [name]          | Application name (default: current directory name)                                                                                                                                     |
| **-p, --platform** [name]      | Deploy to Cloud Run (managed) or Cloud Run on Anthos on Google Cloud (gke) [managed, gke]                                                                                              |
| **-r, --region** [region]      | GCP Region (platform-specific: managed) [asia-northeast1, europe-west1, us-central1, us-east1]                                                                                         |
| **-c, --cluster** [name]       | GKE Cluster to use with Anthos (platform-specific: gke)                                                                                                                                |
| **-z, --clusterzone** [zone]   | GKE Cluster location to use with Anthos (platform-specific: gke)                                                                                                                       |
| **-t, --template** [name]      | Template for Cloud Run services. List of templates can be specified with `crbt list`. This is mutually exclusive with `--sourcerepo`.                                                  |
| **-s, --sourcerepo** [repoUrl] | Git repository URL for project source to copy. Should be in format such as `https://github.com/GoogleCloudPlatform/cloud-run-hello.git`. This is mutually exclusive with `--template`. |
| **-l, --local**                | Use local source within current directory.                                                                                                                                             |
| **-b, --build** [trigger]      | Use Cloud Build build trigger; [trigger] can be `commit` to build and deploy on commit or `none` to not automatically perform any Cloud Build activities.                              |
| **-m, --map** [mapping]        | Create custom domain mapping for Cloud Run service. `none` to skip prompt. (platform-specific: managed)                                                                                |
| **-e, --existing**             | Allow existing files to exist in the project directory (Typically, `--template` wants things to be empty.)                                                                             |
| **-d, --dryrun**               | Only show commands and save configuration, but do not execute them in GCP.                                                                                                             |
| **-v, --verbose**              | Verbose mode                                                                                                                                                                           |

#### customize

This command re-parse the `app.json` file and re-prompts for environment variables, and then updates the environment variables.

#### deploy

This command deploys the Cloud Run service within the current directory by utilizing the `cloudbuild.yaml` file created during initialization. This must be ran inside each Cloud Run service's folder to deploy each service. To destroy these services, `crbt destroy` must be ran inside each folder, as well.

| Option            | Description  |
| ----------------- | ------------ |
| **-v, --verbose** | Verbose mode |

#### destroy

Destroys deployed services. [feature] can be:

-   `all`: (Default) Deletes all services defined within the `.crbt` file.
-   `cloudrun`: Deletes the Cloud Run services. The behavior of this command depends on which file is leveraged to delete the services. The command prefers to leverage the `.crbt` file to delete all services, but if no `.crbt` file then it checks for a `cloudbuild.yaml` in the current directory and deletes that service (in the event of multiple services that need to be deleted, this command would need to be ran in each).

| Option             | Description                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------- |
| **-y, --yes**      | Confirm destroying entire project with no prompts.                                          |
| **-p, --preserve** | Do not delete `.crbt` as the project is destroyed. The `.crbt` file can be used to rebuild. |
| **-r, --rep**      | Override and specify Cloud Source Repositories repo to delete.                              |
| **-v, --verbose**  | Verbose mode                                                                                |

#### list

This command does not have any options.

#### status

This command does not have any options.

#### trigger:create:scheduler

Create a new [Cloud Scheduler](https://cloud.google.com/scheduler) [trigger](https://cloud.google.com/run/docs/triggering/using-scheduler) for the Cloud Run service that calls the service based on [cron](https://en.wikipedia.org/wiki/Cron#Overview) format.

| Option             | Description                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **-s, --schedule** | Schedule on which the job will be executed. (unix-cron format)                                  |
| **-m, --method**   | HTTP method to use for the request [GET, PUT, POST]                                             |
| **-b, --body**     | Data payload to be included as the body of the HTTP request. (only valid for PUT, POST methods) |
| **-a, --account**  | Service account used to authenticate to the Cloud Run service (name only, not email)            |
| **-d, --dryrun**   | Only show commands, but do not execute them in GCP                                              |
| **-v, --verbose**  | Verbose mode                                                                                    |

Additional Cloud Scheduler trigger documentation:

-   Cloud SDK > [gcloud scheduler jobs create http](https://cloud.google.com/sdk/gcloud/reference/scheduler/jobs/create/http)
-   Cloud Run > [Running services on a schedule](https://cloud.google.com/run/docs/triggering/using-scheduler)

#### trigger:delete:scheduler

Remove a [Cloud Scheduler](https://cloud.google.com/scheduler) [trigger](https://cloud.google.com/run/docs/triggering/using-scheduler) for the Cloud Run service.

| Option            | Description  |
| ----------------- | ------------ |
| **-v, --verbose** | Verbose mode |

### Customizing deployment parameters

If you include an `app.json` at the root of your repository, it allows you customize the experience such as defining an alternative service name, or prompting for additional environment variables.

Including an `app.json` file within the root of the project will provide customization parameters to the `init` command. The `app.json` command is meant to be backwards compatible with the [Cloud Run Button](https://github.com/GoogleCloudPlatform/cloud-run-button/)'s `app.json` [format](https://github.com/GoogleCloudPlatform/cloud-run-button/#customizing-source-repository-parameters), while also adding additional features (_Note: Currently `hooks` are not supported._).

A `.crbt` file generated from a deployment can be copied into an `app.json` to rebuild the service based on how it was previously configured.

For example:

```
{
    "name": "foo-app",
    "env": {
        "BACKGROUND_COLOR": {
            "description": "specify a css color",
            "value": "#fefefe",
            "required": false
        },
        "TITLE": {
            "description": "title for your site"
        },
        "APP_SECRET": {
            "description": "secret"
        },
        "VERSION": "1.0"
    },
    "options": {
        "allow-unauthenticated": false
    }
}
```

**Reference**:

-   `name`: _(optional, default: current directory name)_
    Name of the Cloud Run service and the built container image. Equivalent to passing `--name`.
-   `region`: _(optional)_
    Region to deploy the service. Equivalent to passing `--region`.
-   `cloudbuild`: _(optional)_
    Use Cloud Build build trigger for building and deploying. Value can be `commit` to build and deploy on commit or `none` to not automatically perform any Cloud Build activities. Equivalent to passing `--build`.
-   `mapping`: _(optional)_
    Create custom domain mapping for Cloud Run service. Value should be the custom domain to use (e.g. `test.example.com` or `none` to skip.
-   `env`: _(optional)_
    Prompt user for environment variables. No equivalent command line argument or interactive method -- this is the only way to pass environment variables. If passing a direct value instead of an object, set the value without prompting.
    -   `description`: _(optional)_
        Short explanation of what the environment variable does, keep this short to make sure it fits into a line.
    -   `value`: _(optional)_
        Default value for the variable, should be a string.
    -   `required`, _(optional, default: `true`)_
        Indicates if they user must provide a value for this variable.
    -   ~~`generator`, _(optional)_
        Use a generator for the value, currently only support `secret`~~
-   `options`: _(optional)_
    Options when deploying the service
    -   `allow-unauthenticated`: _(optional, default: `true`)_
        Allow unauthenticated requests
-   ~~`hooks`: _(optional)_
    Run commands in separate bash shells with the environment variables configured for the application and environment variables for `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_REGION`, and `K_SERVICE`. Command outputs are shown as they are executed.~~
    -   ~~`precreate`: _(optional)_
        Runs the specified commands before the service has been created~~
        -   ~~`commands`: _(array of strings)_
            The list of commands to run~~
    -   ~~`postcreate`: _(optional)_
        Runs the specified commands after the service has been created~~
        -   ~~`commands`: _(array of strings)_
            The list of commands to run~~

Additional values can be added to the `app.json`, or may be added in the example of using a `.crbt` file as an `app.json`; however, they are ignored and not utilized.

## Templates

| Template                     | Description                                                             |
| ---------------------------- | ----------------------------------------------------------------------- |
| **web-expressjs-helloworld** | Simple Hello World using NodeJS and Express.js for a frontend.          |
| **web-expressjs-fancystore** | Fancy Store site using NodeJS and Express.js for both frontend and API. |
| **backend-gcloud-dataflow**  | Show GCP Dataflow jobs that exceed a maximum duration.                  |
| **api-expressjs-datafiles**  | API using Express.js to serve data files.                               |

## Examples

#### Initialization Examples

The following examples are non-interactive commands that will create different permutations of deployments. All of the below could also be done with just running `crbt init` and answering prompts, as well.

-   Deploy a service based on the publicly available example [Cloud Run Hello World](https://github.com/GoogleCloudPlatform/cloud-run-hello.git) GitHub repository, named hellorun, with Cloud Build CI/CD in US-East1 region, and map the domain `test.example.com` to the service:
    `crbt init -n hellorun -b commit -p managed -r us-east1 --sourcerepo https://github.com/GoogleCloudPlatform/cloud-run-hello.git -m test.example.com`

-   Create service, named after the local directory, with Cloud Build CI/CD in US-East1 region by leveraging the `api-expressjs-datafiles` template, and map the domain `test.example.com` to the service:
    `crbt init --template api-expressjs-datafiles --build commit --platform managed --region us-east1 --map test.example.com`

-   Create a service, named testapp, without Cloud Build CI/CD in US-Central1 region by leveraging the `web-expressjs-helloworld` template:
    `crbt init -n testapp -t web-expressjs-helloworld -b none -p managed -r us-central1 -m none`
    `crbt deploy` (Needed due to no automatic build/deploy)

-   Deploy a service using the source within the current directory, with Cloud Build CI/CD in US-Central1 region, inheritting the name from the local directory:
    `crbt init --local -b commit -p managed -r us-east1 -m none`

-   Create service, named after the local directory, with Cloud Build CI/CD onto the GKE Cluster `central` within the `us-central1-b` zone by leveraging the `web-expressjs-helloworld` template:
    `crbt init --platform gke --cluster central --clusterzone us-central1-b --template web-expressjs-helloworld --build commit`

-   Create service, named exampleapp, without Cloud Build CI/CD onto the GKE Cluster `central` within the `us-central1-b` zone by leveraging the `web-expressjs-fancystore` template:
    `crbt init --name exampleapp --platform gke --cluster central --clusterzone us-central1-b --template web-expressjs-fancystore --build none`
    `crbt deploy` (needed due to no automatic build/deploy)

#### Destroy Examples

-   Destroy everything (no confirmation): `crbt destroy --yes`
-   Destroy everything (excluding `.crbt`): `crbt destroy --preserve`
-   Destroy Cloud Run service: `crbt destroy cloudrun`

#### Status Example

-   Retrieve status: `crbt status`

**Output:**

```
name:       newapplication
platform:   managed
region:     us-east1
project:
  name: es-crtest8
  id:   594320120000
repo:
  name: newapplication
cloudrun:
  newapplication:
    url: https://newapplication-esjxjixyzy-ue.a.run.app
options:
  allow-unauthenticated: true
cloudbuild:
  newapplication-trigger: a389dcd2-a700-xxxx-99d2-20dce913f241
mapping:    jan19-01.esquared.dev
```

#### Trigger Create (Cloud Scheduler) Example

-   Create Cloud Scheduler HTTP GET trigger that runs every hour:

```
crbt trigger:create:scheduler --schedule "0 * * * *" --method GET
```

**Output Example:**

```
=== Cloud Scheduler Trigger Creation

[ > ] Services API enabled: cloudscheduler
[ > ] Services API enabled: appengine
[ ! ] App Engine app not found. Attempting to create...
[ ! ] App Engine app created in: us-east1
[ ? ] What service account would you like to use (name only, not email)? feb17-01-invoker
[ ! ] Service account not found. Attempting to create...
[ > ] Service Account created: feb17-01-invoker@es-lab5.iam.gserviceaccount.com
[ > ] Cloud Run IAM Policy Binding added (feb17-01-invoker@es-lab5.iam.gserviceaccount.com): roles/run.invoker
[ > ] Using schedule: 0 * * * *
[ > ] Using method: GET
[ > ] Cloud Scheduler trigger created.
[ > ] Configuration saved to file (.crbt): trigger -> serviceAccount -> feb17-01-invoker@es-lab5.iam.gserviceaccount.com
[ > ] Configuration saved to file (.crbt): trigger -> name -> scheduler-feb17-01
[ > ] Configuration saved to file (.crbt): trigger -> type -> scheduler
```

## Frequently Asked Questions (FAQ)

###### Can I see what commands will be ran against my GCP Project before it executes them?

Yes, run `crbt init` with the `--dryrun` flag -- this will generate a `.crbt` configuration file based on your parameters. You can then rename the `.crbt` file to `app.json` and run `crbt init --local` (which will automatically pull answers from `app.json`) to run the same commands that were shown during the `--dryrun`. You can still override anything in `app.json` by passing an init flag such as `--region us-central`. The `crbt init --dryrun` will work both interactive and non-interactive modes.

###### Do I need to keep using crbt or keep the .crbt file after the project is bootstrapped?

No, nothing created depends on crbt long-term. You can delete the configuration file, but it means `crbt destroy` will no longer work if you want to use crbt to clean everything up later.

###### How can I delete and recreate my service exactly how I had it (or move it to a new project)?

The `.crbt` file generated from deployment can be renamed to the `app.json` file and `crbt init --local` will pull all of the settings chosen previously. If you changed projects within your `gcloud` settings, this will all be re-provisioned in the new project.

###### How can I add GitHub (or another location) as a repository?

-   GitHub can be added as an additional push repository. First, determine the location of the Cloud Source Repositories push location before adding any others (the --add command replaces the original, and we add it back):

```
git remote -v
```

Expected output:

```
origin  https://source.developers.google.com/p/es-crtest1/r/test6 (fetch)
origin  https://source.developers.google.com/p/es-crtest1/r/test6 (push)
```

Add the GitHub repo as a push location:

```
git remote set-url --add --push origin https://github.com/earlgay/testRepo.git
```

Add the Cloud Source Repositories repo back as a push location (using path determined earlier):

```
git remote set-url --add --push origin https://source.developers.google.com/p/es-crtest1/r/test6
```

Check that both locations are now shown as push locations:

```
git remote -v
```

Expected output:

```
origin  https://source.developers.google.com/p/es-crtest1/r/test6 (fetch)
origin  https://github.com/earlgay/testRepo.git (push)
origin  https://source.developers.google.com/p/es-crtest1/r/test6 (push)
```

Now, when doing `git push origin master` it will push to both repositories. Please note that `crbt destroy` does not include cleaning up any 3rd party repositories that may be added in this manner.

## Known Issues

-   Handling existing resource conflicts may cause overwriting existing resources, or initialization to fail and require rollback with `crbt destroy` and in some cases manual cleanup of deployed services.

## Acknowledgments

Project is inspired from the following other Google projects:

-   [firebase-tools](https://github.com/firebase/firebase-tools): The Firebase Command Line Tools.
-   [cloud-run-button](https://github.com/GoogleCloudPlatform/cloud-run-button): Let anyone deploy your GitHub repos to Google Cloud Run with a single click.

Sample templates based on:

| Template                 | Reference                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| web-expressjs-fancystore | [microservices-demo](https://github.com/GoogleCloudPlatform/microservices-demo)          |
| web-expressjs-helloworld | [cloud-run-hello](https://github.com/GoogleCloudPlatform/cloud-run-hello)                |
| api-expressjs-datafiles  | [monolith-to-microservices](https://github.com/googlecodelabs/monolith-to-microservices) |
| backend-gcloud-dataflow  | [dataflow-time-limit](https://github.com/earlgay/dataflow-time-limit)                    |
