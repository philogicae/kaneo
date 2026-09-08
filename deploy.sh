#!/bin/sh

docker -H tcp://192.168.1.133:2375 compose -f compose-custom.yml up -d