# Temperature Humidity Card

A custom card to show the temperature and humidity in a single card.

![Screenshot of the custom card](./temperature-humidity-card.png)

## Configuration

To add the card into your panel, add a custom YAML card of type `custom:temperature-humidity-card`.

Example configuration:

```yml
type: custom:temperature-humidity-card
title: Kitchen
temperature: sensor.thermometer_kitchen_temperature
humidity: sensor.thermometer_kitchen_humidity
```

A comprehensive list of available options is provided below:

| Field          | Required | Description |
|----------------|----------|-------------|
| title          | Yes      | Card title |
| temperature    | Yes      | Sensor for temperature field in ºC |
| humidity       | Yes      | Sensor for humidity field in % |
