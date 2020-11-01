import {isEmpty} from 'lodash';
import {SQS} from 'aws-sdk';
import {Base64Message} from '../types';
import base = Mocha.reporters.base;

export class SQSHelper {
  private readonly sqsClient: SQS = new SQS({
    endpoint: 'http://localhost:9999',
    region: 'us-east-1',
  });

  public async sendMessage(queueUrl: string, messageBody: string): Promise<boolean> {
    const params: SQS.SendMessageRequest = {
      QueueUrl: queueUrl,
      MessageBody: messageBody,
    };

    const response = await this.sqsClient.sendMessage(params).promise();

    return !isEmpty(response);
  }

  private async deleteMessages(queueUrl: string, messages: SQS.Message[]): Promise<void> {
    const entries = messages.map((message) =>
      ({ 'Id': message.MessageId ?? '', 'ReceiptHandle': message.ReceiptHandle ?? '' })
    );
    await this.sqsClient.deleteMessageBatch({
      QueueUrl: queueUrl,
      Entries: entries
    }).promise();
  }

  public async receiveAllMessages(queueName: string): Promise<Base64Message[]> {
    const params: SQS.ReceiveMessageRequest = {
      QueueUrl: `${this.sqsClient.endpoint.href}000000000000/${queueName}`,
      MaxNumberOfMessages: 10
    };

    let messages: SQS.MessageList = [];
    let base64Messages: Base64Message[] = [];
    try {

      do {
        const response: SQS.ReceiveMessageResult = await this.sqsClient.receiveMessage(params).promise();
        messages = response.Messages ?? [];
        if (messages?.length > 0) {
          await this.deleteMessages(params.QueueUrl, messages);
          messages?.map((message) => base64Messages.push(new Base64Message(message.Body ?? '')));
        }
      } while (messages.length > 0);

      return base64Messages;
    } catch (err) {
      console.log(err);
    }

    return [];
  }

  public async waitForQueue(queueName: string): Promise<void> {
    return await new Promise(resolve => {
      const interval = setInterval(async () => {
        let response: SQS.ListQueuesResult = {};
        try {
           response = await this.sqsClient.listQueues().promise();
        } catch (error) {
          Object.assign(response, { QueueUrls: undefined });
        }
        if (response.QueueUrls && response.QueueUrls?.find((queue) => queue.includes(queueName))) {
          resolve();
          clearInterval(interval);
        }
      }, 1000);
    });
  }
}
