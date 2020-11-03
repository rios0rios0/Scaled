import {Command, flags} from '@oclif/command';
import * as Listr from 'listr';
import * as execa from 'execa';
import * as path from 'path';
import {Observable} from 'rxjs';
import * as fs from 'fs';
import {ServiceDefinition} from '../types';
import ServiceManager from '../manager';
import Resolver from '../resolver';
import {printServices} from '../helpers/display';

export default class Start extends Command {
  static description = 'start a service';

  static args = [
    {
      name: 'service',
      required: true,
      description: 'name of the service to start',
    },
  ];

  static flags = {
    build: flags.boolean({
      description: 'rebuild containers before start',
      required: false,
      default: false,
    }),
    containers: flags.integer({
      description: 'number of containers to scale tool',
      required: false,
      default: 1,
    }),
    'set-env': flags.string({
      description: 'set environment variable on local shell',
      multiple: true,
      required: false,
    }),
  };

  static examples = [
    '$ silent start <tool> --containers <number> --set-env <key>=<value>',
  ];

  private resolver = new Resolver();

  private manager = new ServiceManager();

  async run() {


    const {args: {service: serviceName}, flags: startFlags} = this.parse(Start);

    try {
      let finalReport: string = '';
      const service = await this.resolver.resolveService(serviceName);

      if (!service) {
        this.error(`Service '${serviceName}' not found.`);
      }

      process.on('SIGINT', async () => {
        //this.error('Removing containers gracefully...');
        await this.manager.stop(service!);
        process.exit();
      });

      const tasks = new Listr([
        {
          title: 'Copying environment file',
          task: () => new Observable((resolve) => {
            this.copyDotEnv(service)
              .then(() => resolve.complete())
              .catch((e) => resolve.error(e));
          }),
          enabled: () => this.isThereDotEnv(service),
        },
        {
          title: 'Setting environment variables',
          task: () => new Observable((resolve) => resolve.complete()),
          enabled: () => startFlags['set-env']?.length > 0,
        },
        {
          title: `Starting service '${service?.name}'`,
          task: () => new Observable((resolve) => {
            this.manager.start(service, startFlags,
              (message) => resolve.next(message))
              .then(() => resolve.complete())
              .catch((e) => resolve.error(e));
          }),
        },
        {
          title: 'Getting report result',
          task: () => new Observable((resolve) => {
            this.manager.report(service, startFlags.containers,
              (message) => resolve.next(message))
              .then((report) => {
                finalReport = report;

              })
              .catch((e) => resolve.error(e));
            resolve.complete();
          }),
        },
        /*{
          title: 'Removing all containers...',
          task: () =>new Observable((resolve) => {
            this.manager.stop(service).then(() => resolve.complete()).catch((e) => resolve.error(e));
          }),
        }*/
      ]);

      await tasks.run();

      printServices(service, JSON.parse('{}'));
    } catch (e) {
      this.error(e.message);
    }
  }

  private isThereDotEnv(service: ServiceDefinition): boolean {
    const envExPath = path.resolve(service.path, '.env.example');
    return fs.existsSync(envExPath);
  }

  private async copyDotEnv(service: ServiceDefinition): Promise<void> {
    if (!this.isThereDotEnv(service)) return;
    const envPath = path.resolve(service.path, '.env');
    if (fs.existsSync(envPath)) return;

    await execa('cp', [`${envPath}.example`, envPath]);
  }
}
