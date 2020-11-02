export type Readable = {
  hostnames?: string[];
  ports?: {
    id?: string;
    protocol?: string;
    services?: string[];
  }[]
};

export class NMAPReadableReport {
  public constructor(private readonly readable: Readable) {
  }

  public toJson(): string {
    return JSON.stringify(this.readable);
  }
}
