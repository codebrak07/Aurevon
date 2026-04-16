import { memo, useRef, useState, useEffect } from 'react';
import usePlayer from '../hooks/usePlayer';
import { generateTopMixes } from '../services/aiService';
import './TopMixes.css';

const STATIC_FALLBACK_MIXES = [
  {
    title: 'Indie Mix',
    subtitle: 'The Strokes, Tame Impala, Arctic Monkeys',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP1V60DJma372vZpJsPKr5o77SdUJkvy0zVQKM03bgiRxxlvgQ51AIHrrVhajzaO1CpuwGtO2HKX18zuynZNZyfADU9gIHpMqfwR-t88amXwNUMlcERJUZXt-Z4tL6NcFIS71WdJV4zPGTn5qhNj4xGqjWAffa2XO-DUsNxxydcNuJxw0AYRyaIWLPPouZSE1nXeJ0LGxbmYg63gnLtzGbKRIiWQjJ_JBqqp280q21UZDwf7TaqIDOjOGxZ5lAFWaroRM2ued5YrtU',
    color: '#2a4a3a',
    prompt: 'Indie rock hits like The Strokes and Tame Impala'
  },
  {
    title: '90s Rock Mix',
    subtitle: 'Nirvana, Pearl Jam, Soundgarden',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3cLmyfbZyTDmgDCJR9jZT0ABqIq8doePBKXbVjy2gkDvMN1Wd9I9HBvy0UI2JGGPwEIYoGa4uVfR2yYy1J6PWwTvSRERC1ZxjKGbOE117JojLuSZwPa6EkLSYN7802ImlbKQEyOv8gQ_q1Yp21R5gC3Bpsxk042trdjxX5yx7ejDWIQE79MsKnRGBN0fnLsvK8sInmBurUVmn9ibfRit7SmEgJ1UZhx6HF5n0I02uYFeZT0GtCYPKinMz3wPR7hgYVHM-JW5DMt_K',
    color: '#3a2a2a',
    prompt: '90s grunge and alternative rock classics'
  },
  {
    title: 'Electronic Pulse',
    subtitle: 'Deadmau5, Daft Punk, Aphex Twin',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqnIGv_Rpil6Y-NWabt2Y2byL535iE8b1ypdcWmLKSvWBaqp2TIfImcJnYs2DBUFEseka3_fmiymcGextGRcuK4pC11zpqFo4ksFZVsrzgzVrd01QTiphcm41eoB_R1890O5MkbFmqm47NxcJ80vUNgcTAHxZemwMTs751lC7WIiY2xfAk74RgVN24sWUCko2q9ASWFLrdyqytg7x4ZtLC3RgNniT7ZhypJFUiDrPL0CiNqnrQY2g4-MwuLA6oJ5FGCM53OddC6hLL',
    color: '#1a2a4a',
    prompt: 'Modern electronic and techno pulses'
  },
  {
    title: 'Jazz Lounge',
    subtitle: 'Miles Davis, John Coltrane, Bill Evans',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCNVyXSD3YMUDGq0Ks2cdSDUVNeVffKmo_IQos78VOrgtoK8_sC3UwBMRj_4yqkI3MICYMvcmO6CK64s4s5jJI6Mlg3pMh054wgig0X-d5x3i-zMbHA7ZNmwAEsweYwMVj54mdo7oXcHOpaY_DttrlEWqvAYem2bWNVx1XGF1pSP50MQcdhJImLh4Ozo_4IiQ7GgupDLUHEB5MxsmjBSm96lA002f3nSusCdd47Zp7b5-rbHpDKcFz6K0j_hgz3ndS7aeqF9oNpJzSV',
    color: '#2a2a3a',
    prompt: 'Sophisticated jazz and bebop for late night'
  },
  {
    title: 'Hip Hop Classics',
    subtitle: 'Tupac, Biggie, Nas, Jay-Z',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP1V60DJma372vZpJsPKr5o77SdUJkvy0zVQKM03bgiRxxlvgQ51AIHrrVhajzaO1CpuwGtO2HKX18zuynZNZyfADU9gIHpMqfwR-t88amXwNUMlcERJUZXt-Z4tL6NcFIS71WdJV4zPGTn5qhNj4xGqjWAffa2XO-DUsNxxydcNuJxw0AYRyaIWLPPouZSE1nXeJ0LGxbmYg63gnLtzGbKRIiWQjJ_JBqqp280q21UZDwf7TaqIDOjOGxZ5lAFWaroRM2ued5YrtU',
    color: '#3a1a2a',
    prompt: 'Golden age hip hop and lyrical rap'
  },
];

const TopMixes = memo(function TopMixes() {
  const scrollRef = useRef(null);
  const { startMagicVibe, likedSongs, magicLoading } = usePlayer();
  const [mixes, setMixes] = useState(STATIC_FALLBACK_MIXES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPersonalizedMixes() {
      if (likedSongs.length < 5) {
        setIsLoading(false);
        return;
      }

      try {
        const dynamic = await generateTopMixes(likedSongs);
        if (dynamic) {
          setMixes(dynamic);
        }
      } catch (err) {
        console.error('Failed to load personalized mixes:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPersonalizedMixes();
  }, [likedSongs]);

  const handleMixClick = (mix) => {
    if (magicLoading) return;
    const prompt = mix.prompt || mix.title;
    startMagicVibe(prompt);
  };

  return (
    <section className="top-mixes">
      <div className="top-mixes__header">
        <h3 className="top-mixes__title">Your Top Mixes</h3>
        <button className="top-mixes__see-all">See All</button>
      </div>

      <div className="top-mixes__scroll" ref={scrollRef}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mix-card is-loading">
              <div className="mix-card__art" />
              <div className="mix-card__title" />
              <div className="mix-card__subtitle" />
            </div>
          ))
        ) : (
          mixes.map((mix) => (
            <div 
              key={mix.title} 
              className="mix-card" 
              onClick={() => handleMixClick(mix)}
            >
              <div className="mix-card__art" style={{ backgroundColor: mix.color }}>
                <img src={mix.image} alt={mix.title} loading="lazy" />
                <div className="mix-card__play">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                </div>
              </div>
              <h4 className="mix-card__title">{mix.title}</h4>
              <p className="mix-card__subtitle">{mix.subtitle}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
});

export default TopMixes;
