import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import mqtt from 'mqtt';
const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt')
// const client = mqtt.connect("wss://broker.hivemq.com")

client.on("connect", () => {
  client.subscribe("/Rifqi/TA/Feedback", (err) => {
    if (!err) {
      // client.publish("presence", "Hello mqtt");
    }
  });
});

import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

const Tab = createBottomTabNavigator();

// Komponen untuk layar utama (Beranda)
const HomeScreen = () => {
  const [buttonStatus, setButtonStatus] = useState(true);
  const [sensorData, setSensorData] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState({});



  const publishToMQTT = (pzem, status) => {
    const topic = `/Rifqi/TA`;

    // Bentuk properti dinamis, misalnya: "pzem1": 0
    const payload = {};
    payload[`pzem${pzem}`] = status === 'ON' ? 0 : 1;

    const message = JSON.stringify(payload);

    if (client && client.connected) {
      client.publish(topic, message, {}, (err) => {
        if (err) {
          console.log('MQTT gagal dikirim:', err);
        } else {
          console.log('MQTT dikirim:', topic, message);
        }
      });
    } else {
      console.log('Client MQTT belum terhubung');
    }
  };

  const getDataHarian = async () => {
    const res = await fetch(
      'https://ywgvilqklobqfsyldcpo.supabase.co/rest/v1/sensor?select=*,log_sensor_harian(*)&order=id.asc',
      {
        method: 'GET',
        headers: {
          apikey:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3Z3ZpbHFrbG9icWZzeWxkY3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjYyNjUsImV4cCI6MjA2MTY0MjI2NX0.kmVl0XGkZc5Hkx14s7KIz5E4MY0vAP-zEIvV4bqg0i4',
          Authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3Z3ZpbHFrbG9icWZzeWxkY3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjYyNjUsImV4cCI6MjA2MTY0MjI2NX0.kmVl0XGkZc5Hkx14s7KIz5E4MY0vAP-zEIvV4bqg0i4',
          'Content-Type': 'application/json',
        },
      },
    );

    const data = await res.json();
    setSensorData(data);

    const statusMap = {};
    data.forEach(item => {
      if (item.log_sensor_harian.length > 0) {
        const statusValue = item.status;
        statusMap[item.id] = statusValue == "ON" ? true : false;
      }
    });
    setButtonStatus(statusMap);
    // console.log(statusMap)
    // console.log(data);
  };

  useEffect(() => {
    getDataHarian();

    const interval = setInterval(() => {
      getDataHarian();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    client.on('message', (topic, message) => {
      if (topic === '/Rifqi/TA/Feedback') {
        const payload = JSON.parse(message.toString());
        if (payload.status == true) {
          setLoadingStatus(prev => ({
            ...prev,
            [payload.id]: false,
          }));
        }
      }
    });
  }, []);

  const toggleSwitch = id => {
    setButtonStatus(prevStatus => {
      const newStatus = !prevStatus[id];
      const statusInDb = newStatus ? 'ON' : 'OFF';

      setLoadingStatus(prev => ({
        ...prev,
        [id]: true,
      }));

      publishToMQTT(id, statusInDb);

      fetch(`https://ywgvilqklobqfsyldcpo.supabase.co/rest/v1/sensor?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3Z3ZpbHFrbG9icWZzeWxkY3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjYyNjUsImV4cCI6MjA2MTY0MjI2NX0.kmVl0XGkZc5Hkx14s7KIz5E4MY0vAP-zEIvV4bqg0i4',
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3Z3ZpbHFrbG9icWZzeWxkY3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjYyNjUsImV4cCI6MjA2MTY0MjI2NX0.kmVl0XGkZc5Hkx14s7KIz5E4MY0vAP-zEIvV4bqg0i4',
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: statusInDb }),
      })
        .then(res => {
          if (!res.ok) throw new Error('Gagal update status di Supabase');
          console.log(`Status sensor ${id} diupdate ke ${statusInDb}`);
        })
        .catch(err => {
          console.error('Update gagal:', err);
          // Matikan loading kalau gagal
          setLoadingStatus(prev => ({
            ...prev,
            [id]: false,
          }));
        })

      return {
        ...prevStatus,
        [id]: newStatus,
      };
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}

      {sensorData.length > 0 && (
        <View style={styles.header}>
          <Text style={styles.headerDate}>{dayjs().format('dddd, DD MMMM YYYY • HH:mm')}</Text>
          <Text style={styles.headerPower}>
            {sensorData[0].log_sensor_harian[0]?.power || 'N/A'}Watt
          </Text>
          <Text style={styles.headerDetails}>
            {sensorData[0].log_sensor_harian[0]?.voltage || '0'}V {'   '}
            {sensorData[0].log_sensor_harian[0]?.current || '0'}A {'   '}
            {sensorData[0].log_sensor_harian[0]?.KwH || '0'}KwH
          </Text>
          <TouchableOpacity>
            <Text style={styles.historyLink}>Lihat Histori </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.devicesContainer}>
        {sensorData.slice(1).map((item, index) => {
          const isLoading = loadingStatus[item.id];

          return (
            <View key={index} style={styles.deviceCard}>
              <Text style={styles.deviceTitle}>{item.nama_sensor}</Text>
              {item.log_sensor_harian.length > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deviceInfo}>
                        VOLTAGE: {item.log_sensor_harian[0].voltage}V
                      </Text>
                      <Text style={styles.deviceInfo}>
                        POWER: {item.log_sensor_harian[0].power}W
                      </Text>
                      <Text style={styles.deviceInfo}>
                        STATUS: {item.status ? 'ON' : 'OFF'}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.deviceInfo}>
                        CURRENT: {item.log_sensor_harian[0].current}A
                      </Text>
                      <Text style={styles.deviceInfo}>
                        POWER FACTOR: {item.log_sensor_harian[0].power_factor}
                      </Text>
                      <Text style={styles.deviceInfo}>
                        FREQUENCY: {item.log_sensor_harian[0].frequency}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.deviceFooter}>
                    <Switch
                      value={buttonStatus[item.id] || false}
                      onValueChange={() => toggleSwitch(item.id)}
                      trackColor={{ false: '#767577', true: '#81b0ff' }}
                      thumbColor={buttonStatus[item.id] ? '#f5dd4b' : '#f4f3f4'}
                    />
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#0000ff" />
                    ) : ""}
                    {/* <Text style={styles.deviceTime}>18:00 - 06:30</Text> */}
                    <Text style={styles.devicePower}>{item.log_sensor_harian[0].KwH} KwH</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.deviceInfo}>Tidak ada data harian</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Komponen untuk layar Histori
const HistoryScreen = () => (
  <View style={styles.screen}>
    <Text style={styles.screenText}>Layar Histori</Text>
  </View>
);

// Komponen untuk layar Setting
const SettingsScreen = () => (
  <View style={styles.screen}>
    <Text style={styles.screenText}>Layar Setting</Text>
  </View>
);

const EstimasiScreen = () => (
  <View style={styles.screen}>
    <Text style={styles.screenText}>Layar Estimasi</Text>
  </View>
);

// Aplikasi utama
export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Beranda"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === 'Beranda') iconName = 'home';
            else if (route.name === 'Histori') iconName = 'history';
            else if (route.name === 'Setting') iconName = 'settings';
            return <Icon name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#00A1D6',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}>
        <Tab.Screen name="Histori" component={HistoryScreen} />
        <Tab.Screen name="Beranda" component={HomeScreen} />
        <Tab.Screen name="Setting" component={SettingsScreen} />
        <Tab.Screen name="Estimasi" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    backgroundColor: '#00A1D6',
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
  },
  headerDate: {
    color: '#fff',
    fontSize: 14,
  },
  headerPower: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  headerDetails: {
    color: '#fff',
    fontSize: 16,
  },
  historyLink: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  devicesContainer: {
    flex: 1,
    padding: 10,
  },
  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginVertical: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  deviceInfo: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  deviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  deviceTime: {
    fontSize: 14,
    color: '#666',
  },
  devicePower: {
    fontSize: 14,
    color: '#00A1D6',
    fontWeight: 'bold',
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenText: {
    fontSize: 20,
    color: '#333',
  },
});
