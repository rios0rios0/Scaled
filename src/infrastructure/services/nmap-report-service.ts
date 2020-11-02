import {Base64Message, NMAPReport, NMAPService} from '../../types';
import {parseStringPromise as parser} from 'xml2js';
import {ReportService} from '../../domain/services/report-service';
import {NMAPReadableReport, Readable} from '../../domain/entities/nmap-readable-report';

export class NMAPReportService extends ReportService {

  private static unique(needle: Array<any>, haystack: Array<any>, key: string): Array<any> {
    return haystack.filter((item) => !needle.includes({[key]: item[key]}));
  }

  private static reducer(iterable: Array<any>): Array<any> {
    return iterable.reduce((total, current) => total.concat(current), []);
  }

  private static resolver(service: NMAPService): string {
    if (service?.cpe !== undefined)
      return service?.cpe.reduce((total, current) => total.concat(current), '');
    return `${service.$.name}:${service.$.product}:${service.$.version ?? ''}:${service.$.conf}`;
  }

  static async toReadable(base64Messages: Base64Message[]): Promise<string> {
    if (base64Messages.length > 0) {
      let reports: NMAPReport[] = [];
      const decoded = base64Messages.map((message) => message.decode());
      await decoded.map(async (message) => reports.push(await parser(message)));
      let final: Readable = {};
      reports.map((report) => {

        report.nmaprun.host.map((host) => {

          let hostnames = NMAPReportService.reducer(
            host.hostnames.map(hname => hname.hostname.map(last => last.$.name)),
          );
          hostnames = hostnames.filter((value, index) => hostnames.indexOf(value) === index);

          const ports = NMAPReportService.reducer(
            host.ports.map(hport => hport.port.map(p => ({
              id: p.$.portid, protocol: p.$.protocol,
              services: p.service?.map(hservice => NMAPReportService.resolver(hservice)),
            }))),
          );

          if (final.ports) final.ports.concat(NMAPReportService.unique(final.ports, ports, 'id'));
          else final = { hostnames, ports: [ ...ports ] };
        });
      });

      return new NMAPReadableReport(final).toJson();
    }
    return '{}';
  }
}
