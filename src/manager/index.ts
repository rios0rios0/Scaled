import * as path from 'path';
import * as execa from 'execa';
import { ServiceDefinition } from '../types';

type Flags = {
  build: boolean,
  containers: number,
  'set-env': string[]
}

export default class ManagerService {
  async start(
    service: ServiceDefinition,
    flags: Flags,
    onUpdate: (message: string) => void,
  ): Promise<void> {
    const args = [
      ...this.getComposeArgsForService(service),
      'up',
      '--detach',
      '--no-color',
      '--remove-orphans',
    ];

    let opts = {
      env: {
        CONTAINERS: `${flags.containers}`
      },
    };

    if (flags['set-env'].length > 0) flags['set-env'].map((value) => {
      Object.assign(opts.env, { [value.split('=')[0]]: value.split('=')[1]});
    });

    if (flags.build) args.push('--build');
    if (flags.containers > 1) args.push('--scale', `${service.name}=${flags.containers}`);

    const subprocess = execa('docker-compose', args, { ...opts });
    subprocess.stdout.on('data', (data) => onUpdate(data.toString()));

    await subprocess;
  }

  private getComposeArgsForService(service: ServiceDefinition): string[] {
    const composePath = path.resolve(service.path, 'docker-compose.yml');

    return [
      '--no-ansi',
      '--project-name', service.name.replace(/\//g, '-'),
      '--project-directory', service.path,
      '-f', composePath,
    ];
  }
}
