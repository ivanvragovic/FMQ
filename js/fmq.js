function initializeMap() {
	var position = {coords: {latitude: 52.3695, longitude: 4.8961}};
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(createMap, createMap);
	} else {
		createMap(position);
	}
}

var mainMap;
function createMap(position) {
	
	var mapOptions = {
			center: new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
			zoom: 9,
			mapTypeId: google.maps.MapTypeId.ROADMAP
	}
	var mapCanvas = document.getElementById('map');
	mainMap = new google.maps.Map(mapCanvas, mapOptions);
	if (Object.keys(markers).length > 0) addMapMarkers(); //add map markers if they exist
}

function createHtmlElement(tag, content) {
	return '<' + tag + '>' + content + '</' + tag + '>';
}

function initTable() {
	var tableElement = '';
	var imageExtensions = ['jpg', 'gif', 'jpeg', 'png', 'tif'];
	for (var rowIndex = 0; rowIndex < parsedCSV.data.length; rowIndex++) {
		var dataTag = 'td';
		if (rowIndex == 0) { //start head
			tableElement += '<thead>';
			dataTag = 'th';
		}
		if (rowIndex == 1) { //start body
			tableElement += '<tbody>';
		}
		tableElement += '<tr>';
		if (rowIndex == 0) { //first column with checkbox for hiding row on map
			tableElement += '<' + dataTag + '>Hide on map</' + dataTag + '>';
		} else {
			tableElement += '<td>';
			tableElement += '<input type="checkbox" onchange="cbHideClicked(this)" id="' + rowIndex + '">';
			tableElement += '</td>';
		}
		for (var dataIndex = 0; dataIndex < parsedCSV.data[rowIndex].length; dataIndex++) {
			tableElement += '<' + dataTag + '>';
			var currData = parsedCSV.data[rowIndex][dataIndex];
			var dataElement = '';
			if (currData.lastIndexOf('.') > -1) {
				var dataExt = currData.substr((currData.lastIndexOf('.') + 1));
				if ($.inArray(dataExt, imageExtensions) > -1) { //data is image
					dataElement = '<img onerror="imageErrorHandler()" class="table-image" src="' + currData + '"/>';
				}
			}
			if (!dataElement && isURI(currData)) { //data is link
				dataElement = '<a target="_blank" href="' + currData + '">' + currData + '</a>';
			}
			if (!dataElement) { //everything else
				dataElement = currData;
			}
			tableElement += dataElement;
			tableElement += '</' + dataTag + '>';
		} 
		tableElement += '</tr>';
		if (rowIndex == 0) { // end head
			tableElement += '</thead>';
		}
		if (rowIndex == parsedCSV.data.length - 1) { //end body
			tableElement += '</tbody>';
		}
	}
	
	var colnum = parsedCSV.data[0].length;
	var tableColumnOptions = [{value:'none',label:'None'},
								{value:'lat',label:'Latitude'}, 
								{value:'long',label:'Longitude'}, 
								{value:'marker',label:'Marker Label'}];
	
	//table options in footer
	tableElement += '<tfoot><tr><td></td>'; //first empty because of the hide column
	for (var columnIndex = 0; columnIndex < colnum; columnIndex++) {
		tableElement += '<td><select class="columnOption">';
		for (var colOptIndex = 0; colOptIndex < tableColumnOptions.length; colOptIndex++) {
			tableElement += '<option value="' + tableColumnOptions[colOptIndex].value + '">';
			tableElement += tableColumnOptions[colOptIndex].label + '</option>';
		}
		tableElement += '</select></td>';
	}
	tableElement += '</tr></tfoot>';
	$('#startupsTableWrapper').html('<table id="startupsTable" class="startups-table"></table>'); //reset table
	$('#startupsTable').html(tableElement);
	$('#startupsTable').DataTable({
		"scrollX": true,
		"lengthMenu": [5, 10]
	});
	$('.columnOption').change(columnOptionChanged);
}

function imageErrorHandler() {
	event.target.src = 'images/missing-image.png'
}

var reinitTable = false;

function parseButtonClick() {
	parseCSV();
	$('#collapse-input-data').collapse('hide');
	$('#collapse-view-map').collapse('hide');
	$('#collapse-view-table').collapse('show');
	initTable();
}

function showMapButtonClick() {
	$('#collapse-input-data').collapse('hide');
	$('#collapse-view-table').collapse('hide');
	$('#collapse-view-map').collapse('show');
}

function parseCSV() {
	var separator = $('#separator-select').val().replace('tab', '\t');
	var inputCSV = $('#ta-input-CSV').val();
	var parserConfig = {delimiter: separator};
	parsedCSV = Papa.parse(inputCSV, parserConfig);
	reinitTable = true;
	mapPosDataIndex = {};
	reinitMap = true;
	hiddenRows = [];
	deleteMapMarkers();
}

function checkTableState() {
	if (reinitTable) {
		reinitTable = false;
		initTable();
	}
}

var hiddenRows = [];
function cbHideClicked(element) {
	var rowId = parseInt(element.id);
	var posInArray = $.inArray(rowId, hiddenRows);
	if (element.checked && (posInArray == -1)) {
		hiddenRows.push(rowId);
		deleteMapMarker(rowId);
	}
	if (!element.checked && (posInArray != -1)) {
		hiddenRows.splice(posInArray, 1);
		addMapMarker(rowId, true);
	}
}

var mapPosDataIndex = {};
function columnOptionChanged() {
	var colOptions = $('.columnOption');
	mapPosDataIndex = {};
	for (var coIndex = 0; coIndex < colOptions.length; coIndex++) {
		if ((colOptions[coIndex].value == this.value)
			&& (colOptions[coIndex] != this)) { //duplicate option selected -> remove previous one
			colOptions[coIndex].value = "none";
		}
	
		if (colOptions[coIndex].value != 'none') {
			mapPosDataIndex[colOptions[coIndex].value] = coIndex;
		}
	}
	addMapMarkers();
}

var markers = {};
function addMapMarkers() {
	if (!mainMap) {
		initializeMap();
	}
	deleteMapMarkers();
	var recentered = false;
	for (var dataIndex = 1; dataIndex < parsedCSV.data.length; dataIndex++) {
		var markerValid = addMapMarker(dataIndex, !recentered);
		if (!recentered && markerValid) { //re-center map to first valid marker
			recentered = true;
		}
	}
}

function addMapMarker(dataIndex, recenter) {
	if (dataIndex in markers) { //already added to map
		return true;
	}
	if ($.inArray(dataIndex, hiddenRows) != -1) { //should not display hidden rows
		return false;
	}
	if (Object.keys(mapPosDataIndex).length != 3) { //we need longitude, latitude and marker label
		return false;
	}
	var currLat = parseFloat(parsedCSV.data[dataIndex][mapPosDataIndex.lat]);
	var currLong = parseFloat(parsedCSV.data[dataIndex][mapPosDataIndex.long]);
	var currLabel = parsedCSV.data[dataIndex][mapPosDataIndex.marker];
	if (isNaN(currLat) || isNaN(currLong)) {
		return false;
	}
	if (recenter) { //re-center map to new marker
		mainMap.setCenter({lat: currLat, lng: currLong});
	}
	var marker = new google.maps.Marker({
		position: {lat: currLat, lng: currLong},
		label: currLabel,
		title: currLabel,
		map: mainMap
		});
	markers[dataIndex] = marker;
	
	return true;
}

function deleteMapMarker(dataIndex) {
	markers[dataIndex].setMap(null);
	delete markers[dataIndex];
}

function deleteMapMarkers() {
	for (var dataIndex in markers) {
		deleteMapMarker(dataIndex);
	}
}
var reinitMap = true;
function checkMapState() {
	if (reinitMap) {
		reinitMap = false;
		initializeMap();
	}
}

function isURI(str) {
	var re = /\bhttps?:\/\/[\w\d\.]+\.[\w\d]{2,50}/i;
	return re.test(str);
}

function onFileSelected(event) {
	var selectedFile = event.target.files[0];
	var reader = new FileReader();
	var result = document.getElementById("ta-input-CSV");

	reader.onload = function(event) {
		result.innerHTML = event.target.result;
	};
	reader.readAsText(selectedFile);
}


$(document).ready(function() {
	//google.maps.event.addDomListener(window, 'load', initializeMap);
	$('#collapse-view-table').on('shown.bs.collapse', function () {
		checkTableState();
	});
	$('#collapse-view-map').on('shown.bs.collapse', function () {
		checkMapState();
	});
});