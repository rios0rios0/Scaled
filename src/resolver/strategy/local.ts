import * as fs from 'fs';
import * as path from 'path';
import { ServiceDefinition } from '../../types';
import { ResolverInterface } from './resolver';
import ServiceDefinitionBuilder from '../service-builder';

export default class LocalResolver implements ResolverInterface {
  async resolve(serviceName: string): Promise<ServiceDefinition | undefined> {
    const toolsPath = "./tools";

    for (const eachTool of fs.readdirSync(toolsPath)) {
      const reachedTool = path.resolve(toolsPath, serviceName);
      const composePath = path.resolve(reachedTool, 'docker-compose.yml');

      if (fs.existsSync(composePath))
        return ServiceDefinitionBuilder.new(serviceName, reachedTool).build();
    }

    return undefined;
  }
}
