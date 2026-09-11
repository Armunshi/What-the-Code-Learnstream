import React, { useEffect, useState } from 'react'
import CategoryBar from './CategoryBar'
import CourseComp from './CourseComp'
import axios from '../api/axios';

const TOP_CATEGORY_COUNT = 5;

const GeneralCourses = ({setCourse_id,ButtonName,buttonHandler,errMsg,setErrMsg,showCategoryBar=true,limit}) => {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [courses,setCourses] = useState([])

    // Categories aren't a fixed list — derive them from courses that actually
    // exist, ranked by how many courses each has, so an empty category never
    // shows up as a selectable pill with nothing behind it.
    useEffect(() => {
      const fetchTopCategories = async () => {
        try {
          const response = await axios.get('/courses/getallCourses');
          const allCourses = response.data?.data || [];

          const counts = allCourses.reduce((acc, course) => {
            if (course?.category) acc[course.category] = (acc[course.category] || 0) + 1;
            return acc;
          }, {});

          const topCategories = Object.entries(counts)
            .sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB))
            .slice(0, TOP_CATEGORY_COUNT)
            .map(([name]) => name);

          setCategories(topCategories);
          setSelectedCategory(topCategories[0] || null);
        } catch (err) {
          if (!err?.response) {
            setErrMsg('No Server Response');
          } else {
            setErrMsg('Courses Retrieval Failed');
          }
        }
      };
      fetchTopCategories();
    }, []);

     useEffect(()=>{
            if (!selectedCategory) return;
            const fetchCourses = async ()=>{
              try {
                        const response =await axios.get(`/courses?category=${selectedCategory}`,{
                            headers: { 'Content-Type': 'application/json' },
                            withCredentials: true
                        })

              setCourses(response.data.data|| []);


              } catch (err) {
                console.log(err.response)
                    if (!err?.response) {
                        setErrMsg('No Server Response');
                    }
                    else if (err.response?.status === 401) {
                        setErrMsg('Unauthorized');
                    } else {
                        setErrMsg('Courses Retrieval Failed');
                    }
              }
          }
          fetchCourses();
        },[selectedCategory])

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  const displayedCourses = limit ? courses.slice(0, limit) : courses;

  return (
    <div>
      {showCategoryBar && categories.length > 0 && (
        <>
          <CategoryBar categories={categories} selectedCategory={selectedCategory} onCategorySelect={handleCategoryChange} />
          <br />
        </>
      )}
      <CourseComp courses={displayedCourses} setCourse_id={setCourse_id} ButtonName={ButtonName} buttonHandler={buttonHandler}  errMsg={errMsg} />
    </div>
  );
};

export default GeneralCourses;
