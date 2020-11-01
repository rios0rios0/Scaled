FROM alpine:3.12.0
LABEL name=silent maintainer="rios0rios0 <rios0rios0@outlook.com>" description=""

RUN apk update && apk add --no-cache \
    bash jq curl py-pip \
    tor proxychains-ng \
    nmap nmap-nselibs nmap-scripts openssh && \
    rm -rf /etc/apk/cache

RUN pip install awscli

COPY entrypoint.sh /
ENTRYPOINT ["/entrypoint.sh"]
