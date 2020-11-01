import {ServiceDefinition} from '../types';

export default class ServiceDefinitionBuilder {
  constructor(private name: string, private path: string) {}

  static new(name: string, path: string) {
    return new ServiceDefinitionBuilder(name, path);
  }

  public build(): ServiceDefinition {
    const service: Partial<ServiceDefinition> = {
      name: this.name,
      path: this.path,
    };

    return service as ServiceDefinition;
  }
}
