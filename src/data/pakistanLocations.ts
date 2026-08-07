import { PakistanLocation } from '../types/job';

export const PAKISTAN_LOCATIONS: PakistanLocation[] = [
  {
    province: 'Punjab',
    cities: [
      {
        name: 'Lahore',
        districts: ['Lahore City', 'Gulberg', 'Model Town', 'Cantt', 'DHA', 'Johar Town', 'Iqbal Town']
      },
      {
        name: 'Rawalpindi',
        districts: ['Rawalpindi City', 'Saddar', 'Taxila', 'Gujar Khan', 'Bahria Town', 'Satellite Town']
      },
      {
        name: 'Faisalabad',
        districts: ['Faisalabad City', 'Civil Lines', 'Madina Town', 'Samundri', 'Jaranwala']
      },
      {
        name: 'Multan',
        districts: ['Multan City', 'Cantt', 'Gulgasht Colony', 'Shujabad', 'Bosān']
      },
      {
        name: 'Sialkot',
        districts: ['Sialkot City', 'Sambrial', 'Daska', 'Pasrur', 'Cantt Area']
      },
      {
        name: 'Gujranwala',
        districts: ['Gujranwala City', 'Model Town', 'Satellite Town', 'Kamoke']
      }
    ]
  },
  {
    province: 'Sindh',
    cities: [
      {
        name: 'Karachi',
        districts: ['Karachi South', 'Clifton', 'Karachi East', 'Gulshan-e-Iqbal', 'Korangi', 'DHA Karachi', 'North Nazimabad', 'Saddar']
      },
      {
        name: 'Hyderabad',
        districts: ['Hyderabad City', 'Latifabad', 'Qasimabad']
      },
      {
        name: 'Sukkur',
        districts: ['Sukkur City', 'Rohri', 'New Sukkur']
      }
    ]
  },
  {
    province: 'Khyber Pakhtunkhwa (KPK)',
    cities: [
      {
        name: 'Peshawar',
        districts: ['Peshawar City', 'Hayatabad', 'University Town', 'Cantt']
      },
      {
        name: 'Abbottabad',
        districts: ['Abbottabad City', 'Mandian', 'Havelian', 'Cantt']
      },
      {
        name: 'Mardan',
        districts: ['Mardan City', 'Takht Bhai', 'Katlang']
      }
    ]
  },
  {
    province: 'Balochistan',
    cities: [
      {
        name: 'Quetta',
        districts: ['Quetta City', 'Cantt', 'Chiltan', 'Zarghoon']
      },
      {
        name: 'Gwadar',
        districts: ['Gwadar City', 'Free Zone', 'Pishukan']
      }
    ]
  },
  {
    province: 'Islamabad Capital Territory',
    cities: [
      {
        name: 'Islamabad',
        districts: ['Blue Area (Zone 1)', 'Sector F-6/F-7', 'Sector G-11/G-10', 'Sector I-8/I-9', 'DHA Islamabad', 'Bahria Town Enclave']
      }
    ]
  }
];
