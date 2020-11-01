export type ServiceDefinition = {
  name: string;
  path: string;
};

export type NMAPReport = {
  nmaprun: {
    '$': {
      scanner: string,
      args: string,
      start: string,
      startstr: string,
      version: string,
      xmloutputversion: string
    },
    scaninfo: [{
      '$': {
        type: string,
        protocol: string,
        numservices: string,
        services: string
      }
    }],
    verbose: [{ '$': { level: string } }],
    debugging: [{ '$': { level: string } }],
    host: [{
      '$': { starttime: string, endtime: string },
      status: [{ '$': { state: string, reason: string, reason_ttl: string } }],
      address: [{ '$': { addr: string, addrtype: string } }],
      hostnames: [{
        hostname: [
          { '$': { name: string, type: string } },
          { '$': { name: string, type: string } }
        ]
      }],
      ports: [{
        extraports: [{
          '$': { state: string, count: string },
          extrareasons: [{ '$': { reason: string, count: string } }]
        }],
        port: [{
          '$': { protocol: string, portid: string },
          state: [{
            '$': { state: string, reason: string, reason_ttl: string }
          }],
          service: [{
            '$': {
              name: string,
              product: string,
              version: string,
              extrainfo: string,
              method: string,
              conf: string
            },
            cpe: [string]
          }]
        }]
      }],
      times: [{ '$': { srtt: string, rttvar: string, to: string } }]
    }],
    runstats: [{
      finished: [{
        '$': {
          time: string,
          timestr: string,
          elapsed: string,
          summary: string,
          exit: string
        }
      }],
      hosts: [{ '$': { up: string, down: string, total: string } }]
    }]
  }
}

export class Base64Message {
  constructor(private readonly message: string) {
  }

  get() {
    return this.message;
  }

  public decode(): string {
    return Buffer.from(this.message, 'base64').toString();
  }
}
