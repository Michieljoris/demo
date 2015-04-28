#!/bin/bash

while read oldrev newrev ref
do
    exec demo checkout repo $ref
done
