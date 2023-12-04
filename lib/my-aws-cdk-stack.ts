import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { type Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import axios from 'axios';

const DOMAIN_NAME = 'images.alexmandrik.com';

export class MyAwsCdkStack extends Stack {
  private readonly CLOUDFLARE_API_URL: string = 'https://api.cloudflare.com/client/v4';
  private readonly CLOUDFLARE_API_KEY = this.node.tryGetContext('cloudflareApiKey');
  private readonly CLOUDFLARE_EMAIL = this.node.tryGetContext('cloudflareEmail');
  private readonly CLOUDFLARE_ZONE_ID = this.node.tryGetContext('cloudflareZoneId');

  constructor (scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'MyBucket', {
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName
    });

    const hostedZone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: DOMAIN_NAME
    });

    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: hostedZone.hostedZoneId
    });

    if ((hostedZone.hostedZoneNameServers != null) && hostedZone.hostedZoneNameServers.length > 0) {
      // Output all name servers using Fn.join
      new cdk.CfnOutput(this, 'NameServers', {
        value: cdk.Fn.join(', ', hostedZone.hostedZoneNameServers)
      });

      void this.createCloudflareNSRecords(hostedZone.hostedZoneNameServers);
    }

    // Create a certificate in ACM for the domain
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: DOMAIN_NAME,
      validation: acm.CertificateValidation.fromDns(hostedZone)
    });

    // Create a CloudFront distribution with the certificate and the bucket as the origin
    const distribution = new cloudfront.Distribution(this, 'MyDistribution', {
      defaultBehavior: { origin: new S3Origin(bucket) },
      domainNames: [DOMAIN_NAME],
      certificate
    });

    // Create a DNS record in Route53 for the CloudFront distribution
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: DOMAIN_NAME,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution))
    });
  }

  private async createCloudflareNSRecords (nameServers: string[]): Promise<void> {
    for (let i = 0; i < nameServers.length; i++) {
      await this.createCloudflareNSRecord(nameServers[i]);
    }
  }

  private async createCloudflareNSRecord (nameServer: string): Promise<void> {
    try {
      const response = await axios.post(
            `${this.CLOUDFLARE_API_URL}/zones/${this.CLOUDFLARE_ZONE_ID}/dns_records`,
            {
              type: 'NS',
              name: DOMAIN_NAME,
              content: nameServer
            },
            {
              headers: {
                'X-Auth-Email': this.CLOUDFLARE_EMAIL,
                'X-Auth-Key': this.CLOUDFLARE_API_KEY,
                'Content-Type': 'application/json'
              }
            }
      );

      console.log('DNS Record created successfully:', response.data.result);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log('Error creating DNS Record: ', error.message);
      } else {
        console.log('Unexpected error: ', error);
      }
    }
  };
}
