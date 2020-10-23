#!/usr/bin/env sh

set -e

TOR_LOG=/var/log/tor.log
AWS_LOG=/var/log/aws.log

tor > $TOR_LOG &
while ! grep -qF 'Done' "$TOR_LOG" 2> /dev/null
do
  sleep 2s
done

sqs_check=$(aws --endpoint-url=http://aws:4576 sqs list-queues)
if [ -z "$sqs_check" ]; then
    aws --endpoint-url=http://aws:4576 sqs create-queue --queue-name portlist > $AWS_LOG

    PORT_START=20
    PORT_END=100
    PORTS=`expr "$PORT_END" - "$PORT_START"`
    TOTAL=65535
    CONTAINERS=10

    if [ `echo "$PORTS % $CONTAINERS" | bc` -gt 0 ]; then
        $CONTAINERS=$PORTS
    fi

    containers_by_ports=`echo "$PORTS / $CONTAINERS" | bc`

    i=$PORT_START
    while [  $i -lt $PORT_END ]; do
        list=$(seq -s , $i `expr "$i" + "$containers_by_ports" - 1`)

        aws --endpoint-url=http://aws:4576 sqs send-message \
            --queue-url http://aws:4576/000000000000/portlist \
            --message-body "$list" >> $AWS_LOG

        i=$(( i+$containers_by_ports ))
    done
fi

ports=$(aws --endpoint-url=http://aws:4576 sqs receive-message --queue-url http://aws:4576/000000000000/portlist | jq .Messages[0].Body)
proxychains nmap -sTV --open -p$ports -oG - $TARGET | grep open | tr ',' '\n' | sed 's/Ports:\ /Ports:\n\ /' | cut -d/ -f1,2
