#!/usr/bin/env sh

set -e

TOR_LOG=/var/log/tor.log
AWS_LOG=/var/log/aws.log

tor > $TOR_LOG &
while ! grep -qF 'Done' "$TOR_LOG" 2> /dev/null
do
  sleep 2s
done

sqs_check=$(aws --endpoint-url=http://sqs:4576 sqs list-queues)
if [ -z "$sqs_check" ]; then
    aws --endpoint-url=http://sqs:4576 sqs create-queue --queue-name portlist > $AWS_LOG

    PORTS=`expr "$END_PORT" - "$START_PORT"`

    if [ `echo "$PORTS % $CONTAINERS" | bc` -gt 0 ]; then
        $CONTAINERS=$PORTS
    fi

    reazon=`echo "$PORTS / $CONTAINERS" | bc`

    i=$START_PORT
    while [  $i -lt $END_PORT ]; do
        list=$(seq -s , $i `expr "$i" + "$reazon" - 1`)

        aws --endpoint-url=http://sqs:4576 sqs send-message \
            --queue-url http://sqs:4576/000000000000/portlist \
            --message-body "$list" >> $AWS_LOG

        i=$(( i+$reazon ))
    done
fi

ports=$(aws --endpoint-url=http://sqs:4576 sqs receive-message --queue-url http://sqs:4576/000000000000/portlist | jq .Messages[0].Body | tr -d \")
proxychains -q nmap -PN -sTV --open -p $ports -oG - $TARGET | grep open | tr ',' '\n' | sed 's/Ports:\ /Ports:\n\ /' | cut -d/ -f1,2
