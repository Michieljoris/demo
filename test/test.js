function messageId() {
  return 'xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, function(c) {
return (Math.random()*16|0).toString(16);
  });
  }
    console.log(messageId());
