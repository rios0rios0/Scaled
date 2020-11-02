import * as path from 'path';
import * as execa from 'execa';
import {ServiceDefinition} from '../types';
import {SQSHelper} from '../helpers/sqs';
import {NMAPReportService} from '../infrastructure/services/nmap-report-service';


type Flags = {
  build: boolean,
  containers: number,
  'set-env': string[]
}

export default class ServiceManager {
  async start(
    service: ServiceDefinition,
    flags: Flags,
    onUpdate: (message: string) => void,
  ): Promise<void> {
    const args = [
      ...this.globalArgs(service),
      'up',
      '--detach',
      '--no-color',
      '--remove-orphans',
    ];

    let opts = {
      env: {
        CONTAINERS: `${flags.containers}`,
      },
    };

    if (flags['set-env'].length > 0) flags['set-env'].map((value) => {
      Object.assign(opts.env, {[value.split('=')[0]]: value.split('=')[1]});
    });

    if (flags.build) args.push('--build', '--always-recreate-deps');
    if (flags.containers > 1) args.push('--scale', `${service.name}=${flags.containers}`);

    const subprocess = execa('docker-compose', args, {...opts});
    subprocess.stdout.on('data', (data) => onUpdate(data.toString()));

    await subprocess;
  }

  async report(
    service: ServiceDefinition,
    totalContainers: number,
    onUpdate: (message: string) => void,
  ): Promise<string> {
    const queue = 'reports';
    const sqs = new SQSHelper();
    //onUpdate(`Waiting for SQS queue '${queue}'...`);
    //await sqs.waitForQueue(queue);
    //onUpdate(`Waiting termination of '${service.name}' containers...`);
    //await this.waitForTermination(service, totalContainers, onUpdate);
    //onUpdate('Iterating all resolved reports...');

    const base64Messages = await sqs.receiveAllMessages(`${queue}`);
    return NMAPReportService.toReadable(base64Messages);
  }

  private async waitForTermination(
    service: ServiceDefinition,
    totalContainers: number,
    onUpdate: (message: string) => void,
  ): Promise<void> {
    return await new Promise(resolve => {
      const interval = setInterval(async () => {

        const subprocess = await execa('docker', ['ps']);
        const runningContainers = subprocess.stdout.split('\n').filter((line: string) => {
          return line.includes(`${service.name}_${service.name}`);
        });

        const done = totalContainers - runningContainers.length;
        onUpdate(`Waiting termination of '${service.name}' containers [${done}/${totalContainers}]...`);

        if (done === totalContainers) {
          resolve();
          clearInterval(interval);
        }
      }, 1000);
    });
  }

  private globalArgs(service: ServiceDefinition): string[] {
    const composePath = path.resolve(service.path, 'docker-compose.yml');

    return [
      '--no-ansi',
      '--project-name', service.name.replace(/\//g, '-'),
      '--project-directory', service.path,
      '-f', composePath,
    ];
  }
}
