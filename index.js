;(function(){

// Dependancies ===============

	var amqp = require('amqplib');

// Export =====================

	module.exports = function(options){
		this.host = (typeof options.host == 'string') ? options.host : '127.0.0.1';
		this.username = (typeof options.username == 'string') ? options.username : null;
		this.password = (typeof options.password == 'string') ? options.password : null;
		this.vhost = (typeof options.vhost == 'string') ? options.vhost : null;
		return this;
	}

// Create Channel =============

	module.exports.prototype.channel = function(cb){
		var path = 'amqp://';
		if(this.username){
		 path += this.username;
		  if(this.password)
				path += ':' + this.password;
			path += '@';
		}
		path += this.host;
		if(this.vhost)
			path += '/' + this.vhost;

		amqp.connect(path)
			.then(function(conn){
				console.log('+ RabbitMQ Connected');
				conn.createChannel()
					.then(function(ch){
						var channel = new Channel(ch);
						cb(null, channel);
					})
					.catch(cb);
			})
			.catch(cb);
	}

// Channel Object =============

	function Channel(ch){
		this.ch = ch;
		this.exchange = null;
		this.queue = null;
		this.routingKey = null;
	}

	Channel.prototype.assertExchange = function(exchange, type, durable, cb){
		var self = this;
		this.exchange = exchange;
		this.ch.assertExchange(self.exchange, type ? type : 'direct', {durable: durable ? true : false})
			.then(function(){
				console.log('+ RabbitMQ Exchange Asserted [' + self.exchange + ']');
				cb(null);
			})
			.catch(cb);
	}

	Channel.prototype.assertQueue = function(queue, durable, cb){
		var self = this;
		this.queue = queue;
		this.ch.assertQueue(self.queue, {durable: durable ? true : false})
			.then(function(){
				console.log('+ RabbitMQ Queue Asserted [' + self.queue + ']');
				cb(null);
			})
			.catch(cb);
	}

	Channel.prototype.bindQueue = function(routingKey, cb){
		var self = this;
		if(typeof routingKey == 'function'){
			cb = routingKey;
			routingKey = null;
		}
		this.routingKey = routingKey;
		this.ch.bindQueue(this.queue, this.exchange, this.routingKey)
			.then(function(){
				console.log('+ RabbitMQ Queue Bound [' + self.queue + '][' + self.routingKey + ']');
				cb(null);
			})
			.catch(cb);
	}

	Channel.prototype.consume = function(cb, noAck){
		var self = this;
		this.ch.consume(this.queue, function(message){

			message.fields.acked = false;

			try{
				receive = message.content.toString();
				receive = JSON.parse(receive);
				var name = receive.name;
				var data = receive.data;
			}catch(err){
				console.log('- Message Parse Error [' + err.message + ']');
			}

			console.log('* Receive Message [' + name + ']');

			var ack = function(){
				if(message.fields.acked)
					return;
				message.fields.acked = true;
				self.ch.ack(message);
			}
			var nack = function(){
				if(message.fields.acked)
					return;
				message.fields.acked = true;
				self.ch.nack(message);
			}

			cb(name, data, ack, nack);

		}, {noAck: noAck ? true : false});
	}

	Channel.prototype.publish = function(name, data){

		var send = {
			name: name,
			data: data
		};

		try{
			send = JSON.stringify(send);
			send = new Buffer(send);
		}catch(err){
			console.log('- ' + err.message);
			return;
		}

		this.ch.publish(this.exchange, this.routingKey, send);
	}

}());
