# Changelog

All notable changes to this project will be documented in this file.

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
