# backend-gcloud-dataflow

This [Cloud Run](https://cloud.google.com/run/) service is designed to check for [Dataflow](https://cloud.google.com/dataflow/) jobs within a region that exceed a maximum defined time limit. It is designed to be invoked with [Cloud Scheduler](https://cloud.google.com/scheduler/), but can be done manually. Since this is included as sample code, we don't want to actually cancel anything.

This is based on the project: [earlgay/dataflow-time-limit](https://github.com/earlgay/dataflow-time-limit).

**Disclaimer: This is not an officially supported Google project.**

## Enable Dataflow GCP API

If you're not already using Dataflow, enable the service:

```
gcloud services enable dataflow.googleapis.com
```

## Configure Cloud Scheduler

Follow the below steps to setup Cloud Scheduler to run this service periodically.

1. Enable the Cloud Scheduler API:

```
gcloud services enable cloudscheduler.googleapis.com
```

2. Create a Service Account for Cloud Scheduler to use:

```
gcloud iam service-accounts create [SERVICE-ACCOUNT_NAME] \
   --display-name "[SERVICE_NAME] Invoker"
```

3. Give the newly created Service Account permissions to invoke the service:

```
gcloud run services add-iam-policy-binding [SERVICE_NAME] \
   --member=serviceAccount:[SERVICE-ACCOUNT_NAME]@[PROJECT].iam.gserviceaccount.com \
   --role=roles/run.invoker \
   --platform managed \
   --region [REGION]
```

4. Create the Cloud Scheduler Job (this uses normal Cron syntax, and the below example runs every 1 minutes -- which is good for testing but would ideally be longer for production)

```
gcloud beta scheduler jobs create http [SERVICE_NAME]-job --schedule "*/1 * * * *" \
   --http-method=GET \
   --uri=[SERVICE_URL] \
   --oidc-service-account-email=[SERVICE-ACCOUNT_NAME]@[PROJECT].iam.gserviceaccount.com   \
   --oidc-token-audience=[SERVICE_URL]
```

_Note: If prompted, select yes to create an App Engine project, select yes to enable the App Engine API, and select the same [REGION] for the region._

Confirm the scheduled job was created:

```
gcloud beta scheduler jobs list
```

If you want to change the schedule (e.g. increase to every 5 minutes), run the following:

```
gcloud beta scheduler jobs update http [SERVICE_NAME]-job --schedule "*/5 * * * *"
```

Variable definitions:

-   [SERVICE_NAME]: Name of Cloud Run service.
-   [SERVICE_URL]: URL of the Cloud Run service.
-   [EMAIL]: Email of the user account that is running the `gcloud` command to test.
-   [SERVICE-ACCOUNT-NAME]: Desired name for the service account that Cloud Scheduler will use to invoke the service.
-   [PROJECT]: GCP Project name.

Further documentation:

-   Cloud Scheduler > Documentation > [Running services on a schedule](https://cloud.google.com/run/docs/triggering/using-scheduler)
-   External > [Crontab Manual Page](http://crontab.org/)

## Testing

**Please note: Testing should ONLY be done in a project that does not have ANY production Dataflow jobs or else those have a risk of being canceled.**

There are several ways to test the service:

1. **Locally**: Run everything on your local machine
2. **Cloud Run Service Manually**: Invoke the Cloud Run Service directly without Cloud Scheduler
3. **Entire workflow**: Let Cloud Scheduler and Cloud Run run as they would in production

In all of those scenarios, it can be easier to test with [TIME_LIMIT] set to a very small number (e.g. 0 -- which cancels any job running 1 minute or more). For the Cloud Run service, you can change the TIME_LIMIT through the console of the Cloud Run service, or with the following command:

```
gcloud run services update [SERVICE_NAME] --set-env-vars TIME_LIMIT=0 --platform managed --region [REGION]
```

To change it back, simply run the command again with your desired production time limit.

### Testing Locally

You can run this locally on a machine you have `gcloud` and `node` installed and configured.

1. Make sure `gcloud` is configured to point to the project you want this deployed:

```
gcloud config set project [PROJECT_NAME]
```

2. Set the TIME_LIMIT environment variables within your shell to a lower value to make it easier to test (if desired):

```
export TIME_LIMIT=0
```

3. Install node modules:

```
npm install
```

4. Start the service:

```
node app.js
```

5. Browse to http://localhost:8080 to imitate a Cloud Scheduler invokation.

The following is an example of the service started, being invoked, and the service stopping a job (view from console log):

```
eeg3@mars:~/Code/dataflow-time-limit$ node app.js
App listening on port 8080!
Checking for jobs that exceed configuration maximum duration (0) within us-central1...

Found job violating maximum duration:
         ID: 2020-01-29_14_43_16-1775589797322616320
         Creation Time: 2020-01-29 22:43:17
         Duration: 1
```

If there are no jobs found that violate the maximum duration, it will simply print something similar to the following:

```
Checking for jobs that exceed configuration maximum duration (0) with us-central1...

```

### Testing Cloud Run Service Manually

To test running the Cloud Run service, you can follow the steps in the documentation for [Authenticating developers](https://cloud.google.com/run/docs/authenticating/developers):

1. Grant permissions to your account:

```
gcloud run services add-iam-policy-binding [SERVICE_NAME] \
--member='user:[EMAIL]' \
--role='roles/run.invoker' \
--region=[REGION] \
--platform=managed
```

2. Use the `curl` command to pass an auth token to the service:

```
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" [SERVICE_URL]
```

Assuming no jobs violate the maximum duration, this should return an empty array:

```
[]
```

If there were jobs found, the job IDs would be listed within the above, such as:

```
["2020-02-05_14_41_25-12974929635969093266"]
```

### Testing entire workflow (Cloud Scheduler & Cloud Run Service) with a sample Dataflow Job

Use this [Interactive Tutorial](https://console.cloud.google.com/dataflow?walkthrough_tutorial_id=dataflow_index) that will create a walkthrough pane in your Google Cloud Console to start a job. The job created through the tutorial should run longer than 1 minute, and as a result will be canceled by the service.

You should see within the logs of the Cloud Run Service results showing the job exceeding the duration.

### Cleanup

crbt will not clean up any resources created manually within this README. These will need to be deleted manually:

1. Cloud Scheduler Job
2. IAM Policy
