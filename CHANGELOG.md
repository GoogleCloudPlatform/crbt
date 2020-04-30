# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2020-04-30

### Fixed

-   Improved workflow when not using a Cloud Build trigger to allow for domain mapping.
-   Resolved issue with --dry-run not being respected when not using a Cloud Build trigger.
-   Fixed IAM permissions for Cloud Build when not using a trigger-based deployment.

## [0.1.3] - 2020-03-27

### Added

-   Moved current `customize` into `customize:envvars` and added `customize:domain` to allow for setting domain outside of just during `init`.
-   Domain mapping now allows more than one mapping.
-   Domain mapping now allows removing mappings with `customize:domain` and a mapping back to `none`.
-   Added ability to handle mapping of root domains.

### Fixed

-   Upgraded npm packages.

## [0.1.2] - 2020-02-19

### Added

-   Added the `trigger:create:scheduler` and `trigger:delete:scheduler` commands to allow creating/deleting a Cloud Scheduler job to trigger the Cloud Run service. This supports both authenticated and unauthenticated invocations, and will create/setup service account as needed. `trigger:delete:scheduler` is invoked automatically with `crwt destroy`. This is the first of other potential trigger:[create/delete]:{method} triggers.
-   Updated the `backend-gcloud-dataflow` template's README.md to utilize `trigger:create:scheduler`.
-   Documentation and formatting fixes.
-   Re-ordered commands in help to be alphabetized in list (excluding init).
-   Built in the initial deploy call from `crbt init` to `crbt deploy` which previously required manual execution.

### Fixed

-   Resolved an issue where sufficient permissions were not granted to Cloud Build service account with GKE.
-   Changed the way the `cloudrun` section within the `.crbt` configuration file is stored. Previously used a more complex approach based on earlier prototype approaches. The `parseConfig` library and references were updated to reflect.

## [0.1.1] - 2020-02-13

### Added

-   Additional pre-requisite check for Google Cloud SDK (`gcloud`) configuration.
-   Added check for git authentication to Cloud Source Repositories being setup to prevent failure of committing code using `git push origin master`.
-   Added check for git configuration of name and email to ensure `git commit` can be ran.
-   Additional helpful context on errors.
-   README example clarity.
-   Resolved a bug around using a git repository as the base template.
-   Resolved an uncaught error when trying to delete an already deleted service.

## [0.1.0] - 2020-02-12

### Added

-   Initial release.
