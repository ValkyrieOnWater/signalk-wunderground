# Signal K Plugin for PWS Weather

This is based on the work of [Ilker Temir] (https://github.com/itemir) for [PWS Weather] (https://github.com/itemir/signalk-pwsweather/tree/main)

This supports wind speed, gusts, wind direction, temperature, dewpoint, pressure and humidity.

Important Notes:
  * Requires `navigation.position`, `environment.wind.directionGround`, `environment.wind.speedOverGround` and `environment.outside.temperature`
  * You will likely need [signalk-derived-data](https://github.com/SignalK/signalk-derived-data) plugin for `environment.wind.directionGround` and `environment.wind.speedOverGround`.
  * `environment.outside.pressure` and `environment.outside.humidity` are optional
  * Plugin requires Station ID and password (aka key) you use on  Weather Underground as well as the lat/lon of the station.  
  * Weather Underground doesn't suppport mobile stations so this plugin will only work at your "home dock" where your station is registered.
  * You first need to create a station on [Weather Underground](https://wunderground.com) and enter the corresponding station ID.