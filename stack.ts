import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as path from 'path';
import { Construct } from 'constructs';
import { BuildConfig } from '../config/buildConfig';

export class CcalMspEstadosNotificacionesMailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const buildConfig = new BuildConfig('CcalMspEstadosNotificacionesMailStack', 'dev');

    buildConfig.getConfig().then((config) => {
      const subnetIds = config.SUBNET_IDS?.split(',') ?? [];
      const selectedSubnets = {
        subnets: subnetIds.map((subnetId: string, index: number) =>
          ec2.Subnet.fromSubnetId(this, `Subnet${index}`, subnetId)
        ),
      };

      const vpc = ec2.Vpc.fromLookup(this, 'VPCLatinia', { isDefault: false });

      const lambdaRoleSendNotification = new iam.Role(this, 'SesSendStatusNot', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        description: 'Rol para Lambda que se encargará de enviar el estado de notificaciones a Latinia',
      });

      lambdaRoleSendNotification.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ses:SendRawEmail'],
          resources: [
            'arn:aws:ses:us-east-1:978754454859:identity/bolivariano.com',
            'arn:aws:ses:us-east-1:978754454859:configuration-set/estados-collector',
          ],
          conditions: {
            'ForAllValues:StringLike': {
              'ses:Recipients': [
                '*@bolivariano.com',
                '*@technisys.com',
                '*@2innovateit.com',
                '*@transferunion.com',
              ],
            },
            'StringEquals': {
              'ses:FromAddress': [
                'notificaciones_prb@bolivariano.com',
                'estadodecuenta_prb@bolivariano.com.ec',
                'info@mailing.bolivariano.com.ec',
                'pruebas@bolivariano.com.ec',
                'Avisos24@bolivariano.com',
                'crodriguez@transferunion.com',
                'wguaycha@transferunion.com',
                'gvera@transferunion.com',
                'aprogramador6@transferunion.com',
              ],
            },
          },
        })
      );

      const topicSendStatusToLatinia = new sns.Topic(this, 'ColectorEstadosLatinia', {
        topicName: 'ColectorEstadosLatinia',
        displayName: 'Tópico para eventos del SES',
      });

      const configSetStatusLatinia = new ses.CfnConfigurationSet(this, 'SESConfigSet', {
        name: 'estados-collector',
      });

      new ses.CfnConfigurationSetEventDestination(this, 'SesEventDestination', {
        configurationSetName: configSetStatusLatinia.name!,
        eventDestination: {
          name: 'SesToSnsDestination',
          enabled: true,
          matchingEventTypes: [
            'send',
            'reject',
            'bounce',
            'complaint',
            'delivery',
            'deliveryDelay',
            'renderingFailure',
            'subscription',
          ],
          snsDestination: {
            topicArn: topicSendStatusToLatinia.topicArn,
          },
        },
      });

      const sesEventProcessor = new lambda.Function(this, 'SESEventProcessor', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
        role: lambdaRoleSendNotification,
        vpc,
        vpcSubnets: selectedSubnets,
        environment: {
          STAGE: config.STAGE,
          FORWARD_ENDPOINT: config.ENDPOINT_RECEIVE_STATUS_LATINIA,
        },
      });

      topicSendStatusToLatinia.addSubscription(
        new subscriptions.LambdaSubscription(sesEventProcessor)
      );
    });
  }
}
