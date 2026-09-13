# Temperature Humidity Card

A custom card to show the temperature and humidity in a single card. The dew
point is computed automatically from those two values. Optionally, an outdoor
temperature/humidity reference can be configured to show a ventilation
indicator: a colored badge telling you whether opening a window would help
dry the room out, make it more humid, or make no real difference.

![Screenshot of the custom card](./temperature-humidity-card.png)

## Configuration

To add the card into your panel, add a custom YAML card of type `custom:temperature-humidity-card`.

Example configuration:

```yml
type: custom:temperature-humidity-card
title: Kitchen
temperature: sensor.thermometer_kitchen_temperature
humidity: sensor.thermometer_kitchen_humidity
outdoor_temperature: sensor.weather_station_temperature
outdoor_humidity: sensor.weather_station_humidity
```

A comprehensive list of available options is provided below:

| Field                        | Required | Description |
|------------------------------|----------|-------------|
| title                        | Yes      | Card title |
| temperature                  | Yes      | Sensor for temperature field in ºC |
| humidity                     | Yes      | Sensor for humidity field in % |
| outdoor_temperature          | No       | Outdoor temperature sensor, used together with `outdoor_humidity` to show the ventilation badge |
| outdoor_humidity             | No       | Outdoor humidity sensor. The ventilation badge is only shown when both outdoor fields are set |
| ventilation_mild_threshold   | No       | Absolute humidity difference (g/m³) between indoor and outdoor above which the badge switches from neutral to "could ventilate"/"better not" (default `1`) |
| ventilation_strong_threshold | No       | Absolute humidity difference (g/m³) above which the badge switches to "ventilate now"/"don't ventilate" (default `3`) |

## The ventilation badge

The badge compares the *absolute* humidity indoors and outdoors (not the
relative humidity shown on the card, since that alone isn't comparable across
different temperatures) and shows one of five states, from a much-more-humid
indoors to a much-drier indoors:

| Icon                      | Meaning |
|---------------------------|---------|
| 🟢 `mdi:fan`               | Ventilate now — indoor air is much more humid than outdoor air |
| 🟡🟢 `mdi:fan-chevron-up`   | You could ventilate — indoor air is a bit more humid |
| 🟡 `mdi:fan-off`           | No real difference either way |
| 🟠 `mdi:fan-chevron-down`  | Better not to ventilate — indoor air is a bit drier |
| 🔴 `mdi:fan-remove`        | Don't ventilate — indoor air is much drier than outdoor air |

Hovering the badge shows the reasoning as a tooltip.
