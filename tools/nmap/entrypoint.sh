#!/usr/bin/env bash

set -e

TOR_LOG=/var/log/tor.log
AWS_LOG=/var/log/aws.log

start_wait_tor () {
  echo "Starting Tor proxy..."

  tor > $TOR_LOG &
  while ! grep -qF 'Done' "$TOR_LOG" 2> /dev/null
  do
    sleep 2s
  done

  echo "Started Tor."
}

calculate_targets () {
  echo "Calculating the targets to insert on SQS..."

  PORTS=`expr "$END_PORT" - "$START_PORT"`

  if [ `echo "$PORTS % $CONTAINERS" | bc` -gt 0 ]; then
      $CONTAINERS=$PORTS
  fi

  reazon=`echo "$PORTS / $CONTAINERS" | bc`

  i=$START_PORT
  while [  $i -lt $END_PORT ]; do
      list=$(seq -s , $i `expr "$i" + "$reazon" - 1`)

      aws --endpoint-url=http://sqs:4576 sqs send-message \
          --queue-url http://sqs:4576/000000000000/targets \
          --message-body "$list" >> $AWS_LOG

      i=$(( i+$reazon ))
  done
}

create_sqs_targets_endpoint () {
  echo "Checking if SQS targets endpoint exists..."

  queues=$(aws --endpoint-url=http://sqs:4576 sqs list-queues | jq .QueueUrls | tr -d \")
  if [[ ! "${queues[@]}" =~ "targets" ]]; then #TODO: remove restriction to BASH interpreter
      echo "Creating SQS endpoint..."

      aws --endpoint-url=http://sqs:4576 sqs create-queue --queue-name targets > $AWS_LOG

      calculate_targets
  fi
}

create_sqs_reports_endpoint () {
  echo "Checking if SQS reports endpoint exists..."

  queues=$(aws --endpoint-url=http://sqs:4576 sqs list-queues | jq .QueueUrls | tr -d \")
  if [[ ! "${queues[@]}" =~ "reports" ]]; then #TODO: remove restriction to BASH interpreter
      echo "Creating SQS endpoint..."

      aws --endpoint-url=http://sqs:4576 sqs create-queue --queue-name reports >> $AWS_LOG
  fi
}

start_wait_tor
create_sqs_reports_endpoint
create_sqs_targets_endpoint

echo "Starting NMAP scan with Proxychains..."
ports=$(aws --endpoint-url=http://sqs:4576 sqs receive-message --queue-url http://sqs:4576/000000000000/targets | jq .Messages[0].Body | tr -d \")
proxychains -q nmap -PN -sTV --open -p $ports -oX - $TARGET > report.xml

echo "Posting report result to SQS..."
aws --endpoint-url=http://sqs:4576 sqs send-message \
    --queue-url http://sqs:4576/000000000000/reports \
    --message-body "$(cat report.xml | base64)" >> $AWS_LOG
