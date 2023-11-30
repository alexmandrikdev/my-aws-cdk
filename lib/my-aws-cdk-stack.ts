import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';

export class MyAwsCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const bucket = new Bucket(this, 'MyFirstBucket', {
        versioned: true,
    });

    // Make the bucket accessible through CloudFront distribution
    new Distribution(this, 'MyFirstDistribution', {
        defaultBehavior: { origin: new S3Origin(bucket) },
    });
  }
}
