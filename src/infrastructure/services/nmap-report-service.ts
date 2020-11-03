import {Base64Message, NMAPReport, NMAPService} from '../../types';
import {parseStringPromise as parser} from 'xml2js';
import {ReportService} from '../../domain/services/report-service';
import {NMAPReadableReport, Readable} from '../../domain/entities/nmap-readable-report';
import * as util from 'util';

export class NMAPReportService extends ReportService {

  private static unique(haystack: Array<any>, needle: Array<any>, key: string): Array<any> {
    return haystack.concat(needle.filter((item) => !haystack.includes({[key]: item[key]})));
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

          //console.log(report.nmaprun.$.args);

          if (report.nmaprun.host)
            report.nmaprun.host.map((host) => {

              let hostnames = NMAPReportService.reducer(
                host.hostnames.map(hname => hname.hostname.map(last => last.$.name)),
              );
              hostnames = hostnames.filter((value, index) => hostnames.indexOf(value) === index);

              let ports = NMAPReportService.reducer(
                host.ports.map(hport => hport.port.map(p => ({
                  id: p.$.portid, protocol: p.$.protocol,
                  services: p.service?.map(hservice => NMAPReportService.resolver(hservice)),
                }))),
              );

              console.log('ports', util.inspect(host.ports, {depth: 5, colors: true}));

              if (final.ports) final.ports = NMAPReportService.unique(final.ports, ports, 'id');
              else final = {hostnames, ports: [...ports]};
            });
        });

        //console.log(util.inspect(final, {depth: 5, colors: true}));
        return new NMAPReadableReport(final).toJson();
      }

    return '{}';
  }
}
