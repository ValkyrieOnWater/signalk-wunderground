/*
 * Based on material
 * Copyright 2022 Ilker Temir <ilker@ilkertemir.com>
 * Modified 2025 by ValkyrieOnWater to adapt to Weather Underground.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const POLL_INTERVAL = 1      // Poll every N seconds
const UPDATE_POSITION_INTERVAL = 90 // Update every N minutes
const SUBMIT_URL = 'https://weatherstation.wunderground.com/weatherstation/updateweatherstation.php'
const request = require('request')
const dateFormat = require('dateformat')

const median = arr => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = [];
  var submitProcess;
  var statusProcess;
  var lastSuccessfulUpdate;
  var name = app.getSelfPath('name');
  var windSpeed = [];
  var windGust;
  var windDirection;
  var dewpoint;
  var temperature;
  var pressure;
  var humidity;
  var UV;
  var distance;
    var position;

  plugin.id = "signalk-wunderground";
  plugin.name = "SignalK Weather Underground";
  plugin.description = "Weather Underground plugin for Signal K, will only work with fixed location and will not submit when you are away";

  plugin.schema = {
    type: 'object',
    required: ['stationId', 'password', 'submitInterval','stationLat','stationLon'],
    properties: {
      stationId: {
        type: 'string',
        title: 'Station ID (obtain from wunderground.com)'
      },
      password: {
        type: 'string',
        title: 'Password/key (wunderground.com)'
      },
       submitInterval: {
        type: 'number',
        title: 'Submit Interval (minutes)',
        default: 5
      },
        stationLat: {
            type: 'number',
            title: 'Station Latitude ('
        },
        stationLon: {
            type: 'number',
            title: 'Station Longitude'
        }
    }
  }

  plugin.start = function(options) {
    if ((!options.stationId) || (!options.password)) {
      app.error('Station ID and password are required');
      return
    } 

    app.setPluginStatus(`Submitting weather report every ${options.submitInterval} minutes`);

    let subscription = {
      context: 'vessels.self',
      subscribe: [{
        path: 'navigation.position',
        period: POLL_INTERVAL * 1000
      }, {
        path: 'environment.wind.directionGround',
        period: POLL_INTERVAL * 1000
      }, {
        path: 'environment.wind.speedOverGround',
        period: POLL_INTERVAL * 100 // higher poll rate for gust handling
      }, {
        path: 'environment.water.temperature',
        period: POLL_INTERVAL * 1000
      }, {
        path: 'environment.outside.dewpoint',
        period: POLL_INTERVAL * 1000
      }, {
        path: 'environment.outside.temperature',
        period: POLL_INTERVAL * 1000
      }, {
        path: 'environment.outside.dewPointTemperature',
        period: POLL_INTERVAL * 1000
      }, {
        path: 'environment.outside.uv',
        period: POLL_INTERVAL * 1000
      }, {
        path: 'environment.outside.pressure',
        period: POLL_INTERVAL * 1000
      }, {
        path: 'environment.outside.humidity',
        period: POLL_INTERVAL * 1000
      }]
    };

    app.subscriptionmanager.subscribe(subscription, unsubscribes, function() {
      app.debug('Subscription error');
    }, data => processDelta(data));

    app.debug(`Starting submission process every ${options.submitInterval} minutes`);

    statusProcess = setInterval( function() {
      if (!lastSuccessfulUpdate) {
        return;
      }
      let since = timeSince(lastSuccessfulUpdate);
      app.setPluginStatus(`Last successful submission was ${since} ago`);
    }, 60*1000);

    submitProcess = setInterval( function() {
      let now = new Date();
      date = dateFormat(now, 'UTC:yyyy-mm-dd HH:MM:01');
    distance = getDistance(position.latitude, position.longitude, options.stationLat, options.stationLon);
    if (distance > 400) { 
            app.debug('Vessel is more than 400m away from Fixed Location, skipping submission');
            return;
        }
      let httpOptions = SUBMIT_URL.concat('?ID=', options.stationId, '&PASSWORD=', options.password, '&dateutc=', date, '&winddir=', windDirection, '&windspeedmph=', median(windSpeed), '&windgustmph=', windGust,'&dewptf=', dewpoint, '&tempf=', temperature, '&humidity=', humidity, '&baromin=', pressure, '&UV=',UV,'&action=updateraw');
      app.debug(`Submitting data: ${httpOptions}`);
      request(httpOptions, function (error, response, body) {
        if ((!error || response.statusCode == 200) && body.trim == 'success') {
          app.debug('Weather report successfully submitted');
	        app.debug(body);
	        lastSuccessfulUpdate = Date.now();
        } else {
          app.debug('Error submitting weather report');
          app.debug(`|${body}|`); 
        }
        //null all variables whether successful or not
        position = null;
        UV = null;
        windSpeed = [];
        windGust = null;
        windDirection = null;
        waterTemperature = null;
        dewpoint = null;
        temperature = null;
        pressure = null;
        humidity = null;
      }); 
    }, options.submitInterval * 60 * 1000);
  }

  plugin.stop =  function() {
    clearInterval(statusProcess);
    clearInterval(submitProcess);
    app.setPluginStatus('Pluggin stopped');
  };

 
  function getKeyValue(key, maxAge) {
    let data = app.getSelfPath(key);
    if (!data) {
      return null;
    }
    let now = new Date();
    let ts = new Date(data.timestamp);
    let age = (now - ts) / 1000;
    if (age <= maxAge) {
      return data.value
    } else {
      return null;
    }
  }

  function metersSecondToMph(value) {
    return value * 2.237;
  }

  function radiantToDegrees(rad) {
    return rad * 57.2958;
  }

  function kelvinToFahrenheit(deg) {
    return (deg - 273.15) * 9 / 5 + 32;
  }

  function pascalToInches(val) {
    return val / 3386.388;
  }

  function getDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c*1000; // Distance in km
    return d;
  }
  
  function deg2rad(deg) {
    return deg * (Math.PI/180)
  }


  function processDelta(data) {
    let dict = data.updates[0].values[0];
    let path = dict.path;
    let value = dict.value;

    switch (path) {
      case 'navigation.position':
        position = value;
        break;
      case 'environment.wind.speedOverGround':
        let speed = metersSecondToMph(value);
        speed = speed.toFixed(2);
        speed = parseFloat(speed);
	if ((windGust == null) || (speed > windGust)) {
	  windGust = speed;
	}
	windSpeed.push(speed);
        break;
      case 'environment.wind.directionGround':
        windDirection = radiantToDegrees(value);
        windDirection = Math.round(windDirection);
        break;
      case 'environment.water.temperature':
        waterTemperature = kelvinToFahrenheit(value);
        waterTemperature = waterTemperature.toFixed(1);
        waterTemperature = parseFloat(waterTemperature);
        break;
      case 'environment.outside.uv':
          UV=value;
          UV = UV.toFixed(2);
          UV = parseFloat(UV);
        break;
      case 'environment.outside.temperature':
        temperature = kelvinToFahrenheit(value);
        temperature = temperature.toFixed(1);
        temperature = parseFloat(temperature);
        break;
      case 'environment.outside.dewPointTemperature':
            dewpoint = kelvinToFahrenheit(value);
            dewpoint = dewpoint.toFixed(1);
            dewpoint = parseFloat(dewpoint);
            break;
      case 'environment.outside.pressure':
	pressure = pascalToInches(value);
        pressure= pressure.toFixed(2); //2 decimal places for pressure
        pressure = parseFloat(pressure);
        break;
      case 'environment.outside.humidity':
        humidity = Math.round(100*parseFloat(value));
        break;
      default:
        app.debug('Unknown path: ' + path);
    }
  }

  function timeSince(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    var interval = seconds / 31536000;
    if (interval > 1) {
      return Math.floor(interval) + " years";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return Math.floor(interval) + " months";
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return Math.floor(interval) + " days";
    }
    interval = seconds / 3600;
    if (interval > 1) {
      let time = Math.floor(interval);
      if (time == 1) {
        return (`${time} hour`);
      } else {
	return (msg = `${time} hours`);
      }
    }
    interval = seconds / 60;
    if (interval > 1) {
      let time = Math.floor(interval);
      if (time == 1) {
        return (`${time} minute`);
      } else {
	return (msg = `${time} minutes`);
      }
    }
    return Math.floor(seconds) + " seconds";
  }

  return plugin;
}