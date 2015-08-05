#!/bin/bash
pwd
REPO=$1
BRANCH=$2
DB=$3
echo 'Resetting '$DB
echo 'Preparing sql dump file'
sed  "s/chin_minimal/$DB/g" < ~/chin_minimal.sql  >~/db.sql
echo 'Importing sql dump'
mysql -u root -pmypwd < ~/db.sql
cd ~/repos/$REPO/branches/$BRANCH
echo 'Now in '`pwd`
echo 'Executing rake db:migrate'
DATABASE_URL=mysql2://root:mypwd@localhost/$DB; rake db:migrate
