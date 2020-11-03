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

  PORTS=`expr "$END_PORT" - "$START_PORT" + 1`

  if [ $CONTAINERS -gt $PORTS ]; then
      CONTAINERS=$PORTS
  fi

  reazon=`echo "$PORTS / $CONTAINERS" | bc`
  remain=`echo "$PORTS % $CONTAINERS" | bc`

  targets_file='targets.json'
  echo '[' > $targets_file
  count=$START_PORT
  while [  $count -le $END_PORT ]; do
      start=$count
      end=`expr $count + $reazon - 1`
      if [ $end -gt $END_PORT ]; then
        end=$END_PORT
      fi

      if [ $remain -gt 0 ]; then
        end=$(( end+1 ))
        remain=$(( remain-1 ))
        count=$(( count+1 ))
      fi

      count=$(( count+$reazon )) #TODO: don't use count after here


      separator=''
      if [ $count -lt $END_PORT ]; then
        separator=','
      fi

      range="$start-$end"
      echo "{ \"Id\": \"$range\"," >> $targets_file
      echo "\"MessageBody\": \"$range\" }$separator" >> $targets_file
  done
  echo ']' >> $targets_file

  aws --endpoint-url=http://sqs:4576 sqs send-message-batch \
      --queue-url http://sqs:4576/000000000000/targets \
      --entries file://$targets_file >> $AWS_LOG
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
message=$(aws --endpoint-url=http://sqs:4576 sqs receive-message --queue-url http://sqs:4576/000000000000/targets)
handle=$(echo $message | jq .Messages[0].ReceiptHandle | tr -d \")
ports=$(echo $message | jq .Messages[0].Body | tr -d \")
aws --endpoint-url=http://sqs:4576 sqs delete-message \
    --queue-url http://sqs:4576/000000000000/targets \
    --receipt-handle $handle >> $AWS_LOG

echo "proxychains -q nmap -PN -sTV --open -p $ports -oX - $TARGET > report.xml"
proxychains -q nmap -PN -sTV --open -p $ports -oX - $TARGET > report.xml

echo "Posting report result to SQS..."
aws --endpoint-url=http://sqs:4576 sqs send-message \
    --queue-url http://sqs:4576/000000000000/reports \
    --message-body "$(cat report.xml | base64)" >> $AWS_LOG
