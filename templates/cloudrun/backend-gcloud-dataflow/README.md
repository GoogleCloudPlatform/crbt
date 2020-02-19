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

1. Create a Cloud Scheduler trigger that runs hourly:

```
crbt trigger:create:scheduler --schedule "0 * * * *" --method GET
```

Further documentation:

-   Cloud Scheduler > Documentation > [Running services on a schedule](https://cloud.google.com/run/docs/triggering/using-scheduler)
-   External > [Crontab Manual Page](http://crontab.org/)

## Testing

**Please note: Testing should ONLY be done in a project that does not have ANY production Dataflow jobs.**

There are several ways to test the service:

1. **Locally**: Run everything on your local machine
2. **Cloud Run Service Manually**: Invoke the Cloud Run Service directly without Cloud Scheduler
3. **Entire workflow**: Let Cloud Scheduler and Cloud Run run as they would in production

In all of those scenarios, it can be easier to test with [TIME_LIMIT] set to a very small number (e.g. 0 -- which cancels any job running 1 minute or more). For the Cloud Run service, you can change the TIME_LIMIT with the following command:

```
crbt customize
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
