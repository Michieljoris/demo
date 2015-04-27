#!/bin/bash

while read oldrev newrev ref
do
    exec demo 'repo' $ref 'checkout'
done
