import { ServiceDefinition } from '../types';
import resolvers from './strategy';

export default class Resolver {
  async resolveService(serviceName: string): Promise<ServiceDefinition | undefined> {
    for (const resolver of resolvers) {
      const service = await resolver.resolve(serviceName);
      if (service) return service;
    }

    return undefined;
  }
}
